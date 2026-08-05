//! Android JNI bindings
//! This module is only compiled when the `android` feature is enabled.

use jni::objects::{JClass, JString};
use jni::sys::{jint, jlong, jstring};
use jni::JNIEnv;

use crate::{create_encoder, Decoder, Density, ModulationMode};
use crate::modulation::value_to_color;

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_createEncoder(
    _env: JNIEnv,
    _class: JClass,
    density_str: JString,
    mode_str: JString,
) -> jlong {
    let density = _env.get_string(density_str).ok()
        .and_then(|s| Density::from_str(&s.to_str().unwrap_or("medium")))
        .unwrap_or(Density::Medium);

    let mode = match _env.get_string(mode_str).ok().and_then(|s| s.to_str().ok()) {
        Some("rgb8") => ModulationMode::Rgb8,
        Some("mono") => ModulationMode::Mono,
        Some("spatial") => ModulationMode::Spatial,
        _ => ModulationMode::Rgb4,
    };

    let encoder = Box::new(create_encoder(density, mode));
    Box::into_raw(encoder) as jlong
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_encodeMessage(
    env: JNIEnv,
    _class: JClass,
    ptr: jlong,
    message: JString,
) -> jstring {
    if ptr == 0 {
        return env.new_string("error").unwrap().into_raw();
    }

    let encoder = unsafe { &*(ptr as *const crate::encoder::Encoder) };
    let msg: String = env.get_string(message).unwrap().into();

    let (frames, total, _) = encoder.encode_message(&msg);

    // Return JSON-like string for simplicity (first frame + metadata)
    let first_frame = frames.get(0).map(|f| format!("{:?}", f)).unwrap_or_default();
    let result = format!(r#"{{"total_frames":{},"first_frame_len":{},"sample":"{}"}}"#, 
        total, first_frame.len(), first_frame.chars().take(80).collect::<String>());

    env.new_string(result).unwrap().into_raw()
}

#[no_mangle]
pub extern "system" fn Java_com_photonlab_PhotonNative_renderFrame(
    env: JNIEnv,
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
    h6: jlong, h7: jlong,
) {
    // TODO: implement full decoder JNI
}
