//! Photon Core — Portable optical screen-to-camera communication library
//! 
//! This crate contains the pure computation logic for the Photon protocol.
//! It is designed to be used from:
//! - Desktop / CLI tests
//! - Native mobile apps (via JNI / FFI)
//! - Future WebAssembly, etc.

pub mod modulation;
pub mod packet;
pub mod homography;
pub mod checksum;
pub mod encoder;
pub mod decoder;

pub use modulation::{ModulationMode, value_to_color, color_to_value, bits_per_symbol};
pub use packet::{GridGeom, build_frame_payload, parse_header, bytes_to_frames, HEADER_CELLS};
pub use homography::{compute_homography, apply_homography, order_corners};
pub use checksum::checksum_of;
pub use encoder::Encoder;
pub use decoder::Decoder;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum PhotonError {
    #[error("Invalid grid density")]
    InvalidDensity,
    #[error("Homography computation failed")]
    HomographyFailed,
    #[error("Insufficient data")]
    InsufficientData,
    #[error("Checksum mismatch")]
    ChecksumMismatch,
}

/// Supported grid densities
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Density {
    Small,   // 16x12
    Medium,  // 24x18
    Large,   // 32x24
    XLarge,  // 48x36
    XXLarge, // 64x48
}

impl Density {
    pub fn dimensions(&self) -> (usize, usize) {
        match self {
            Density::Small => (16, 12),
            Density::Medium => (24, 18),
            Density::Large => (32, 24),
            Density::XLarge => (48, 36),
            Density::XXLarge => (64, 48),
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "small" | "16x12" => Some(Density::Small),
            "medium" | "24x18" => Some(Density::Medium),
            "large" | "32x24" => Some(Density::Large),
            "xlarge" | "48x36" => Some(Density::XLarge),
            "xxlarge" | "64x48" => Some(Density::XXLarge),
            _ => None,
        }
    }
}

/// Convenience function to create a default encoder
pub fn create_encoder(density: Density, modulation: ModulationMode) -> Encoder {
    let (w, h) = density.dimensions();
    Encoder::new(w, h, modulation)
}
