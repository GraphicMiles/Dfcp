//! High-level encoder

use crate::modulation::{ModulationMode, value_to_color};
use crate::packet::{GridGeom, build_frame_payload, bytes_to_frames, HEADER_CELLS};

pub struct Encoder {
    pub width: usize,
    pub height: usize,
    pub margin: f32,
    pub geom: GridGeom,
    pub mode: ModulationMode,
}

impl Encoder {
    pub fn new(grid_w: usize, grid_h: usize, mode: ModulationMode) -> Self {
        let geom = GridGeom::new((grid_w, grid_h), 800.0, 600.0, 60.0);
        Self {
            width: grid_w,
            height: grid_h,
            margin: 60.0,
            geom,
            mode,
        }
    }

    pub fn set_mode(&mut self, mode: ModulationMode) {
        self.mode = mode;
    }

    /// Encode message into list of symbol frames
    pub fn encode_message(&self, text: &str) -> (Vec<Vec<u16>>, usize, usize) {
        let msg_bytes = text.as_bytes();
        let mut len_bytes = [0u8; 4];
        let len = msg_bytes.len() as u32;
        len_bytes.copy_from_slice(&len.to_be_bytes());

        let mut full: Vec<u8> = Vec::with_capacity(4 + msg_bytes.len());
        full.extend_from_slice(&len_bytes);
        full.extend_from_slice(msg_bytes);

        let total_cells = self.width * self.height;
        let payload_cells = total_cells - HEADER_CELLS;

        let byte_frames = bytes_to_frames(&full, payload_cells, self.mode);
        let total_frames = byte_frames.len();

        let mut symbol_frames = Vec::new();
        for (idx, chunk) in byte_frames.iter().enumerate() {
            let frame = build_frame_payload(idx, total_frames, chunk, payload_cells, self.mode);
            symbol_frames.push(frame);
        }

        (symbol_frames, total_frames, payload_cells)
    }

    /// Render a frame to a raw RGB buffer (for native rendering)
    pub fn render_frame(&self, symbols: &[u16], out_width: usize, out_height: usize) -> Vec<u8> {
        let mut buf = vec![0u8; out_width * out_height * 3];
        let cell_w = self.geom.cell_w;
        let cell_h = self.geom.cell_h;

        for row in 0..self.height {
            for col in 0..self.width {
                let idx = row * self.width + col;
                let v = symbols.get(idx).copied().unwrap_or(0);
                let (r, g, b) = value_to_color(v, self.mode);

                let x0 = (self.margin + col as f32 * cell_w) as usize;
                let y0 = (self.margin + row as f32 * cell_h) as usize;
                let w = cell_w.ceil() as usize + 1;
                let h = cell_h.ceil() as usize + 1;

                for y in y0..(y0 + h).min(out_height) {
                    for x in x0..(x0 + w).min(out_width) {
                        let off = (y * out_width + x) * 3;
                        if off + 2 < buf.len() {
                            buf[off] = r;
                            buf[off + 1] = g;
                            buf[off + 2] = b;
                        }
                    }
                }
            }
        }

        // Draw magenta markers
        let ms = 40usize;
        let positions = [
            (30, 30),
            (out_width - 30 - ms, 30),
            (out_width - 30 - ms, out_height - 30 - ms),
            (30, out_height - 30 - ms),
        ];

        for (px, py) in positions {
            for y in py..(py + ms).min(out_height) {
                for x in px..(px + ms).min(out_width) {
                    let off = (y * out_width + x) * 3;
                    if off + 2 < buf.len() {
                        buf[off] = 255;
                        buf[off + 1] = 0;
                        buf[off + 2] = 255;
                    }
                }
            }
        }

        buf
    }
}
