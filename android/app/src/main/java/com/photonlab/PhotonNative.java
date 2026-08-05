package com.photonlab;

public class PhotonNative {
    static {
        System.loadLibrary("photon_core");
    }

    public static native long createEncoder(String density, String mode);
    public static native String encodeMessage(long encoderPtr, String message);
    public static native String renderFrame(long encoderPtr, int frameIdx);
    public static native void destroyEncoder(long encoderPtr);

    // Future camera / calibration JNI
    public static native void setHomography(long decoderPtr, 
        long h0, long h1, long h2, long h3, long h4, long h5, long h6, long h7);
}
