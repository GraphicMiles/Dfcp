# Photon Core (Rust)

Portable core library for the Photon optical screen-to-camera protocol.

## Build

```bash
cargo build --release
cargo run --bin photon-test
```

## Android

```bash
cargo install cargo-ndk
cargo ndk -t arm64-v8a -t armeabi-v7a build --release
```

Output goes to `jniLibs/`.

## Features

- Pure Rust implementation of encoder/decoder
- Multiple modulation modes
- Homography + marker support
- Designed for JNI / FFI use
- No heavy dependencies

This is the foundation for the native mobile version of Photon Lab.
