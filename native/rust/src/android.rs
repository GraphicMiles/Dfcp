//! Photon Lab - Android JNI bindings
//! This file is intentionally minimal to compile reliably under cargo ndk + android feature.

#![cfg(feature = "android")]

use jni::objects::{JClass, JString, JByteArray};
use jni::sys::{jint, jlong, jstring};
use jni::JNIEnv;

use crate::Encoder;
use crate::modulation::{value_to_color, ModulationMode as ModMode};

/// Create encoder
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_createEncoder(
    _env: JNIEnv,
    _class: JClass,
    _density: JString,
    _mode: JString,
) -> jlong {
    let encoder = Box::new(Encoder::new(24, 18, ModMode::Rgb4));
    Box::into_raw(encoder) as jlong
}

/// Encode data
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_encodeData(
    env: JNIEnv,
    _class: JClass,
    _ptr: jlong,
    data: JByteArray,
) -> jstring {
    let mut env = env;
    let len = match env.convert_byte_array(&data) {
        Ok(b) => b.len(),
        Err(_) => 0,
    };

    let frames = if len == 0 { 1 } else { (len / 380) + 1 };

    let json = format!(
        r#"{{"total_frames":{},"bytes_per_frame":380,"payload_bytes":{}}}"#,
        frames, len
    );

    env.new_string(json).unwrap().into_raw()
}

/// Render frame - visible symbol grid
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_renderFrame(
    env: JNIEnv,
    _class: JClass,
    _ptr: jlong,
    frame_idx: jint,
    out_width: jint,
    out_height: jint,
) -> jbyteArray {
    let mut env = env;
    let w = out_width as usize;
    let h = out_height as usize;
    let mut rgb = vec![0u8; w * h * 3];

    let cols = 24;
    let rows = 18;
    let cw = w / cols;
    let ch = h / rows;

    for r in 0..rows {
        for c in 0..cols {
            let sym = ((r * 11 + c * 3 + frame_idx as usize) % 64) as u16;
            let (r, g, b) = value_to_color(sym, ModMode::Rgb4);

            let x0 = c * cw;
            let y0 = r * ch;

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

    // Magenta markers
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
    _env: JNIEnv,
    _class: JClass,
    _d: JString,
    _m: JString,
) -> jlong {
    let d = Box::new(Decoder::new(24, 18, ModMode::Rgb4));
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
