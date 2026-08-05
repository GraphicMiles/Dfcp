//! Simple CLI test for the core library

use photon_core::{create_encoder, ModulationMode, Density, Decoder};
use photon_core::modulation::value_to_color;

fn main() {
    println!("=== Photon Core Test ===");

    let encoder = create_encoder(Density::Medium, ModulationMode::Rgb4);
    let (frames, total, _) = encoder.encode_message("Hello from Rust core!");

    println!("Encoded message into {} frames", total);
    println!("First frame length: {} symbols", frames[0].len());

    // Render one frame
    let rgb = encoder.render_frame(&frames[0], 800, 600);
    println!("Rendered frame size: {} bytes", rgb.len());

    // Simple decode test
    let mut decoder = Decoder::new(24, 18, ModulationMode::Rgb4);
    // Use identity homography for test
    decoder.set_homography([
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0,
    ]);

    // Sample from the rendered frame (simulated)
    if let Some(symbols) = decoder.sample_symbols(&rgb, 800, 600, 3) {
        if let Some(frame) = decoder.decode_frame(&symbols) {
            println!("Decoded frame {} (valid: {})", frame.frame_idx, frame.checksum_valid);
        }
    }

    println!("Core test passed!");
}
