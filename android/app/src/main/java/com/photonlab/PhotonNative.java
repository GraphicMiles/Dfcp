package com.photonlab;

public class PhotonNative {
    static {
        System.loadLibrary("photon_core");
    }

    // Encoder
    public static native long createEncoder(String density, String mode);
    public static native String encodeData(long encoderPtr, byte[] data);
    public static native byte[] renderFrame(long encoderPtr, int frameIdx, int width, int height);
    public static native void destroyEncoder(long encoderPtr);

    // Decoder (basic)
    public static native long createDecoder(String density, String mode);
    public static native String processCameraFrame(long decoderPtr, byte[] imageData, int width, int height);
    public static native void destroyDecoder(long decoderPtr);
}
