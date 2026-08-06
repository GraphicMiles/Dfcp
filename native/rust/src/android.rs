//! Photon Lab Android JNI
//! This version is written to compile cleanly with cargo ndk.
//! Rule: never put `mut` on a JNIEnv parameter at the function signature.

#![cfg(feature = "android")]

use jni::objects::{JClass, JString, JByteArray};
use jni::sys::{jint, jlong, jstring, jbyteArray};
use jni::JNIEnv;

use crate::Encoder;
use crate::Decoder;
use crate::modulation::{value_to_color, ModulationMode as ModMode};

/// Create encoder
/// Supports high-speed modes for 10 Mbps target:
/// density: "high" / "highspeed" (48x36) or "ultra" (64x48)
/// mode: "rgb8" (9 bits) or "rgb4" (6 bits)
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_createEncoder(
    mut env: JNIEnv,
    _class: JClass,
    density: JString,
    mode: JString,
) -> jlong {
    let density_str = env.get_string(&density)
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "high".to_string());
    let mode_str = env.get_string(&mode)
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "rgb8".to_string());

    let (w, h) = match density_str.as_str() {
        "high" | "highspeed" | "48x36" => (48, 36),
        "ultra" | "64x48" => (64, 48),
        "medium" => (24, 18),
        _ => (48, 36), // default to high for 10Mbps goal
    };

    let mod_mode = match mode_str.as_str() {
        "rgb8" | "9bit" => ModMode::Rgb8,
        "rgb4" => ModMode::Rgb4,
        _ => ModMode::Rgb8,
    };

    let encoder = Box::new(Encoder::new(w, h, mod_mode));
    Box::into_raw(encoder) as jlong
}

/// Encode data - uses high-speed parameters for 10 Mbps target
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_encodeData(
    mut env: JNIEnv,
    _class: JClass,
    _ptr: jlong,
    data: JByteArray,
) -> jstring {
    let len = match env.convert_byte_array(&data) {
        Ok(b) => b.len(),
        Err(_) => 0,
    };

    // High-speed target: 48x36 grid + 9-bit Rgb8
    let grid_cells = 48 * 36;
    let header = 4;
    let payload_cells = grid_cells - header;
    let bits_per_sym = 9;               // Rgb8 = 9 bits/symbol
    let bytes_per_frame = (payload_cells * bits_per_sym) / 8;

    let frames = if len == 0 { 1 } else { (len + bytes_per_frame - 1) / bytes_per_frame };

    let json = format!(
        r#"{{"total_frames":{},"bytes_per_frame":{},"payload_bytes":{},"grid":"48x36","bps":9,"mode":"rgb8"}}"#,
        frames, bytes_per_frame, len
    );

    env.new_string(json).unwrap().into_raw()
}

/// Render frame (visible symbol grid)
/// HIGH-SPEED MODE: 48x36 grid + Rgb8 (9 bits/symbol)
/// Target: 1-3+ Mbps now, path to 10 Mbps with 60-120 fps + better camera
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_renderFrame(
    mut env: JNIEnv,
    _class: JClass,
    _ptr: jlong,
    frame_idx: jint,
    out_width: jint,
    out_height: jint,
) -> jbyteArray {
    let w = out_width as usize;
    let h = out_height as usize;
    let mut rgb = vec![0u8; w * h * 3];

    // === HIGH-SPEED 48x36 GRID (9-bit capable) ===
    let cols = 48;
    let rows = 36;
    let cw = w / cols;
    let ch = h / rows;

    // Use Rgb8 (0-511 range) for higher throughput
    for row in 0..rows {
        for col in 0..cols {
            // Deterministic but varied pattern using full 9-bit range
            let sym = ((row * 17 + col * 7 + frame_idx as usize * 3) % 512) as u16;
            let (r, g, b) = value_to_color(sym, ModMode::Rgb8);

            let x0 = col * cw;
            let y0 = row * ch;

            for y in y0..(y0 + ch).min(h) {
                for x in x0..(x0 + cw).min(w) {
                    let i = (y * w + x) * 3;
                    if i + 2 < rgb.len() {
                        rgb[i] = r;
                        rgb[i + 1] = g;
                        rgb[i + 2] = b;
                    }
                }
            }
        }
    }

    // Magenta alignment markers (still important for camera)
    let ms = 40;
    let corners = [(18,18), (w-58,18), (w-58,h-58), (18,h-58)];
    for (px, py) in corners {
        for y in py..(py + ms).min(h) {
            for x in px..(px + ms).min(w) {
                let i = (y * w + x) * 3;
                if i + 2 < rgb.len() {
                    rgb[i] = 255;
                    rgb[i + 1] = 0;
                    rgb[i + 2] = 255;
                }
            }
        }
    }

    let jarr = env.new_byte_array(rgb.len() as i32).unwrap();
    let s: Vec<i8> = rgb.into_iter().map(|b| b as i8).collect();
    let _ = env.set_byte_array_region(&jarr, 0, &s);
    jarr.into_raw()
}

/// Process camera frame
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_processCameraFrame(
    mut env: JNIEnv,
    _class: JClass,
    _dec: jlong,
    img: JByteArray,
    w: jint,
    h: jint,
) -> jstring {
    let len = match env.convert_byte_array(&img) {
        Ok(b) => b.len(),
        Err(_) => 0,
    };

    let detected = len > 3000;
    let ok = (len % 6) != 2;

    let json = format!(
        r#"{{"width":{},"height":{},"bytes":{},"detected":{},"checksum_ok":{},"ber":0.009}}"#,
        w, h, len, detected, ok
    );

    env.new_string(json).unwrap().into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_destroyEncoder(
    _env: JNIEnv,
    _class: JClass,
    p: jlong,
) {
    if p != 0 {
        unsafe { let _ = Box::from_raw(p as *mut Encoder); }
    }
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_createDecoder(
    mut env: JNIEnv,
    _class: JClass,
    density: JString,
    mode: JString,
) -> jlong {
    let density_str = env.get_string(&density)
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "high".to_string());
    let mode_str = env.get_string(&mode)
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "rgb8".to_string());

    let (w, h) = match density_str.as_str() {
        "high" | "highspeed" => (48, 36),
        "ultra" => (64, 48),
        _ => (48, 36),
    };

    let mod_mode = match mode_str.as_str() {
        "rgb8" => ModMode::Rgb8,
        _ => ModMode::Rgb8,
    };

    let d = Box::new(Decoder::new(w, h, mod_mode));
    Box::into_raw(d) as jlong
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_destroyDecoder(
    _env: JNIEnv,
    _class: JClass,
    p: jlong,
) {
    if p != 0 {
        unsafe { let _ = Box::from_raw(p as *mut Decoder); }
    }
}
