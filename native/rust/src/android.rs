//! Android JNI bindings
//! This module is only compiled when the `android` feature is enabled.

#![cfg(feature = "android")]

use jni::objects::{JClass, JString};
use jni::sys::{jint, jlong, jstring};
use jni::JNIEnv;

use crate::{create_encoder, Decoder, Density, ModulationMode};
use crate::modulation::value_to_color;

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_createEncoder(
    mut env: JNIEnv,
    _class: JClass,
    density_str: JString,
    mode_str: JString,
) -> jlong {
    let density = match env.get_string(&density_str) {
        Ok(s) => {
            let rust_str = s.to_str().unwrap_or("medium");
            Density::from_str(rust_str).unwrap_or(Density::Medium)
        }
        Err(_) => Density::Medium,
    };

    let mode = match env.get_string(&mode_str) {
        Ok(s) => match s.to_str() {
            Ok("rgb8") => ModulationMode::Rgb8,
            Ok("mono") => ModulationMode::Mono,
            Ok("spatial") => ModulationMode::Spatial,
            _ => ModulationMode::Rgb4,
        },
        Err(_) => ModulationMode::Rgb4,
    };

    let encoder = Box::new(create_encoder(density, mode));
    Box::into_raw(encoder) as jlong
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_encodeMessage(
    mut env: JNIEnv,
    _class: JClass,
    ptr: jlong,
    message: JString,
) -> jstring {
    if ptr == 0 {
        return env.new_string("error").unwrap().into_raw();
    }

    let encoder = unsafe { &*(ptr as *const crate::encoder::Encoder) };
    let msg: String = match env.get_string(&message) {
        Ok(s) => s.to_str().unwrap_or_default().to_owned(),
        Err(_) => String::new(),
    };

    let (frames, total, _) = encoder.encode_message(&msg);

    // Return JSON-like string for simplicity (first frame + metadata)
    let first_frame = frames.get(0).map(|f| format!("{:?}", f)).unwrap_or_default();
    let result = format!(r#"{{"total_frames":{},"first_frame_len":{},"sample":"{}"}}"#, 
        total, first_frame.len(), first_frame.chars().take(80).collect::<String>());

    env.new_string(result).unwrap().into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_renderFrame(
    mut env: JNIEnv,
    _class: JClass,
    ptr: jlong,
    frame_idx: jint,
) -> jstring {
    // Simplified: just return dimensions
    env.new_string("800x600").unwrap().into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_destroyEncoder(
    _env: JNIEnv,
    _class: JClass,
    ptr: jlong,
) {
    if ptr != 0 {
        unsafe { drop(Box::from_raw(ptr as *mut crate::encoder::Encoder)); }
    }
}

// Simple calibration / decode stubs for future expansion
#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_setHomography(
    _env: JNIEnv,
    _class: JClass,
    decoder_ptr: jlong,
    h0: jlong, h1: jlong, h2: jlong,
    h3: jlong, h4: jlong, h5: jlong,
    h6: jlong, _h7: jlong,
) {
    // TODO: implement full decoder JNI
    // All h* params are currently unused (stub)
    let _ = (decoder_ptr, h0, h1, h2, h3, h4, h5, h6);
}
