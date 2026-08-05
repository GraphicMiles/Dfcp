//! Frame / packet construction and parsing

use crate::modulation::{ModulationMode, bits_per_symbol};
use crate::checksum::checksum_of;

pub const HEADER_CELLS: usize = 4;

#[derive(Clone, Debug)]
pub struct GridGeom {
    pub width: usize,
    pub height: usize,
    pub cell_w: f32,
    pub cell_h: f32,
    pub margin: f32,
}

impl GridGeom {
    pub fn new(density: (usize, usize), canvas_w: f32, canvas_h: f32, margin: f32) -> Self {
        let (w, h) = density;
        let gw = canvas_w - 2.0 * margin;
        let gh = canvas_h - 2.0 * margin;
        Self {
            width: w,
            height: h,
            cell_w: gw / w as f32,
            cell_h: gh / h as f32,
            margin,
        }
    }

    pub fn cell_center(&self, col: usize, row: usize) -> (f32, f32) {
        (
            self.margin + self.cell_w * (col as f32 + 0.5),
            self.margin + self.cell_h * (row as f32 + 0.5),
        )
    }
}

pub fn bytes_to_frames(
    full_bytes: &[u8],
    payload_cells: usize,
    mode: ModulationMode,
) -> Vec<Vec<u8>> {
    let bps = bits_per_symbol(mode);
    let bytes_per_frame = (payload_cells * bps) / 8;

    let mut frames = Vec::new();
    let mut i = 0;
    while i < full_bytes.len() {
        let end = (i + bytes_per_frame).min(full_bytes.len());
        let mut chunk = full_bytes[i..end].to_vec();
        if chunk.len() < bytes_per_frame {
            chunk.resize(bytes_per_frame, 0);
        }
        frames.push(chunk);
        i += bytes_per_frame;
    }
    if frames.is_empty() {
        frames.push(vec![0; bytes_per_frame]);
    }
    frames
}

pub fn build_frame_payload(
    frame_idx: usize,
    total_frames: usize,
    chunk: &[u8],
    payload_cells: usize,
    mode: ModulationMode,
) -> Vec<u16> {
    let is_last = if frame_idx + 1 == total_frames { 63 } else { 0 };
    let checksum = checksum_of(chunk);
    let idx_low = (frame_idx & 0x3f) as u16;
    let idx_high = ((frame_idx >> 6) & 0x3f) as u16;

    let mut header = vec![idx_low, idx_high, is_last, checksum];

    // Pack bytes into symbols
    let mut bit_str = String::new();
    for b in chunk {
        bit_str.push_str(&format!("{:08b}", b));
    }

    let bps = bits_per_symbol(mode);
    let needed = payload_cells * bps;
    while bit_str.len() < needed {
        bit_str.push('0');
    }

    let mut symbols = Vec::new();
    for i in (0..needed).step_by(bps) {
        let val = u16::from_str_radix(&bit_str[i..i + bps], 2).unwrap_or(0);
        symbols.push(val);
    }

    header.extend(symbols);
    header
}

pub fn parse_header(vals: &[u16]) -> Option<(usize, bool, u16)> {
    if vals.len() < HEADER_CELLS {
        return None;
    }
    let idx_low = vals[0] as usize;
    let idx_high = vals[1] as usize;
    let flags = vals[2];
    let checksum = vals[3];
    let frame_idx = idx_low | (idx_high << 6);
    let is_final = flags == 63;
    Some((frame_idx, is_final, checksum))
}
