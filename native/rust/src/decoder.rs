//! Core decoder logic (portable)

use crate::modulation::{ModulationMode, color_to_value};
use crate::packet::{GridGeom, parse_header, HEADER_CELLS};
use crate::homography::apply_homography;
use crate::checksum::verify_checksum;

#[derive(Clone, Debug)]
pub struct DecodedFrame {
    pub frame_idx: usize,
    pub bytes: Vec<u8>,
    pub checksum_valid: bool,
    pub is_final: bool,
}

pub struct Decoder {
    pub geom: GridGeom,
    pub homography: Option<[f32; 9]>,
    pub mode: ModulationMode,
}

impl Decoder {
    pub fn new(width: usize, height: usize, mode: ModulationMode) -> Self {
        let geom = GridGeom::new((width, height), 800.0, 600.0, 60.0);
        Self {
            geom,
            homography: None,
            mode,
        }
    }

    pub fn set_homography(&mut self, h: [f32; 9]) {
        self.homography = Some(h);
    }

    /// Sample symbols from raw RGB image data (width x height x 3 or x 4)
    pub fn sample_symbols(
        &self,
        image: &[u8],
        img_width: usize,
        img_height: usize,
        channels: usize,
    ) -> Option<Vec<u16>> {
        let h = self.homography?;
        let mut symbols = Vec::new();

        for row in 0..self.geom.height {
            for col in 0..self.geom.width {
                let (cx, cy) = self.geom.cell_center(col, row);
                let p = apply_homography(&h, cx, cy);

                let px = p.x.round() as isize;
                let py = p.y.round() as isize;

                if px < 0 || py < 0 || px as usize >= img_width || py as usize >= img_height {
                    return None;
                }

                let idx = ((py as usize) * img_width + px as usize) * channels;
                if idx + 2 >= image.len() {
                    return None;
                }

                let r = image[idx];
                let g = image[idx + 1];
                let b = image[idx + 2];

                let v = color_to_value(r, g, b, self.mode);
                symbols.push(v);
            }
        }
        Some(symbols)
    }

    pub fn decode_frame(&self, symbols: &[u16]) -> Option<DecodedFrame> {
        if symbols.len() < HEADER_CELLS {
            return None;
        }

        let (frame_idx, is_final, checksum) = parse_header(symbols)?;

        let data_vals = &symbols[HEADER_CELLS..];
        let mut bit_str = String::new();
        for &v in data_vals {
            bit_str.push_str(&format!("{:06b}", v)); // assumes 6-bit for now
        }

        let mut bytes = Vec::new();
        for i in (0..bit_str.len()).step_by(8) {
            if i + 8 <= bit_str.len() {
                if let Ok(b) = u8::from_str_radix(&bit_str[i..i + 8], 2) {
                    bytes.push(b);
                }
            }
        }

        let valid = verify_checksum(&bytes, checksum);

        Some(DecodedFrame {
            frame_idx,
            bytes,
            checksum_valid: valid,
            is_final,
        })
    }
}
