//! Modulation modes and symbol ↔ color conversion
//! Pure functions — no platform dependencies.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModulationMode {
    Rgb4,      // 4 levels per channel → 6 bits
    Rgb8,      // 8 levels per channel → 9 bits
    Mono,      // Intensity only
    Spatial,   // High-contrast spatial patterns
    Analog,    // Experimental waveform mode
}

impl Default for ModulationMode {
    fn default() -> Self {
        ModulationMode::Rgb4
    }
}

const LEVELS_4: [u8; 4] = [40, 105, 170, 235];
const LEVELS_8: [u8; 8] = [20, 50, 80, 110, 140, 170, 200, 230];

pub fn bits_per_symbol(mode: ModulationMode) -> usize {
    match mode {
        ModulationMode::Rgb8 => 9,
        _ => 6,
    }
}

/// Convert symbol value (0-63 for RGB4, 0-511 for RGB8) to RGB
pub fn value_to_color(v: u16, mode: ModulationMode) -> (u8, u8, u8) {
    match mode {
        ModulationMode::Rgb8 => {
            let r = LEVELS_8[((v >> 6) & 7) as usize];
            let g = LEVELS_8[((v >> 3) & 7) as usize];
            let b = LEVELS_8[(v & 7) as usize];
            (r, g, b)
        }
        ModulationMode::Mono => {
            let lvl = LEVELS_4[(v & 3) as usize];
            (lvl, lvl, lvl)
        }
        ModulationMode::Spatial => {
            let base = LEVELS_4[(v & 3) as usize];
            (base, base, 255 - base)
        }
        ModulationMode::Analog => {
            let val = (v as f32 * 255.0 / 63.0).clamp(0.0, 255.0) as u8;
            (val, (val as f32 * 0.6) as u8, (val as f32 * 0.3) as u8)
        }
        ModulationMode::Rgb4 => {
            let r = LEVELS_4[((v >> 4) & 3) as usize];
            let g = LEVELS_4[((v >> 2) & 3) as usize];
            let b = LEVELS_4[(v & 3) as usize];
            (r, g, b)
        }
    }
}

/// Decode RGB values back to nearest symbol
pub fn color_to_value(r: u8, g: u8, b: u8, mode: ModulationMode) -> u16 {
    match mode {
        ModulationMode::Rgb8 => {
            fn nearest8(x: u8) -> usize {
                LEVELS_8.iter()
                    .enumerate()
                    .min_by_key(|(_, &v)| (x as i32 - v as i32).abs())
                    .map(|(i, _)| i)
                    .unwrap_or(0)
            }
            ((nearest8(r) as u16) << 6) | ((nearest8(g) as u16) << 3) | (nearest8(b) as u16)
        }
        ModulationMode::Mono | ModulationMode::Analog => {
            let lum = ((r as u16 + g as u16 + b as u16) / 3) as u8;
            LEVELS_4.iter()
                .enumerate()
                .min_by_key(|(_, &v)| (lum as i32 - v as i32).abs())
                .map(|(i, _)| i as u16)
                .unwrap_or(0)
        }
        ModulationMode::Spatial => {
            let avg = ((r as u16 + g as u16 + b as u16) / 3) as u8;
            (avg / 64).min(3) as u16
        }
        ModulationMode::Rgb4 => {
            fn nearest(x: u8) -> usize {
                LEVELS_4.iter()
                    .enumerate()
                    .min_by_key(|(_, &v)| (x as i32 - v as i32).abs())
                    .map(|(i, _)| i)
                    .unwrap_or(0)
            }
            ((nearest(r) as u16) << 4) | ((nearest(g) as u16) << 2) | (nearest(b) as u16)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgb4_roundtrip() {
        let mode = ModulationMode::Rgb4;
        for v in 0..64u16 {
            let (r, g, b) = value_to_color(v, mode);
            let decoded = color_to_value(r, g, b, mode);
            assert_eq!(decoded, v);
        }
    }
}
