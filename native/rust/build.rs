// Build script for Android cross-compilation hints
fn main() {
    // When building for Android, this helps cargo find the NDK
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "android" {
        println!("cargo:rustc-link-lib=c++");
    }
}
