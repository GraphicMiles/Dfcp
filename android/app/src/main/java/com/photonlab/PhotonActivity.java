package com.photonlab;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

public class PhotonActivity extends Activity {
    private static final String TAG = "PhotonLab";
    private static final int PICK_FILE_REQUEST = 101;
    private static final int CAMERA_PERMISSION = 100;

    private ImageView previewImage;
    private ProgressBar progressBar;
    private TextView statsText, payloadInfo;
    private Button btnPickFile, btnStartTx, btnStartRx, btnStop, btnTestCore;

    private AtomicLong encoderPtr = new AtomicLong(0);
    private AtomicLong decoderPtr = new AtomicLong(0);

    private boolean isTransmitting = false;
    private boolean isReceiving = false;

    private byte[] currentPayload;
    private String currentFileName = "no-file";
    private int totalFrames = 0;
    private int framesSent = 0;
    private int framesDecoded = 0;
    private int checksumFails = 0;

    private long txStartTime = 0;

    private ExecutorService executor = Executors.newSingleThreadExecutor();
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    private ProcessCameraProvider cameraProvider;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_photon);

        previewImage = findViewById(R.id.previewImage);
        progressBar = findViewById(R.id.progressBar);
        statsText = findViewById(R.id.statsText);
        payloadInfo = findViewById(R.id.payloadInfo);

        btnPickFile = findViewById(R.id.btnPickFile);
        btnStartTx = findViewById(R.id.btnStartTx);
        btnStartRx = findViewById(R.id.btnStartRx);
        btnStop = findViewById(R.id.btnStop);
        btnTestCore = findViewById(R.id.btnTestCore);

        btnPickFile.setOnClickListener(v -> pickFile());
        btnStartTx.setOnClickListener(v -> startRealTransmission());
        btnStartRx.setOnClickListener(v -> startRealReceiving());
        btnStop.setOnClickListener(v -> stopEverything());
        btnTestCore.setOnClickListener(v -> testRustCore());

        statsText.setText("Photon Lab v0.2 — Real Encode/Decode Ready\nPick a small file (<2MB) to begin.");
        updatePayloadInfo("No payload loaded");

        if (encoderPtr.get() == 0) {
            encoderPtr.set(PhotonNative.createEncoder("medium", "rgb4"));
        }
        if (decoderPtr.get() == 0) {
            decoderPtr.set(PhotonNative.createDecoder("medium", "rgb4"));
        }
    }

    private void pickFile() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(intent, PICK_FILE_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE_REQUEST && resultCode == RESULT_OK && data != null) {
            loadFile(data.getData());
        }
    }

    private void loadFile(Uri uri) {
        try {
            InputStream is = getContentResolver().openInputStream(uri);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int read;
            while ((read = is.read(buf)) != -1) baos.write(buf, 0, read);
            is.close();

            currentPayload = baos.toByteArray();
            currentFileName = uri.getLastPathSegment() != null ? uri.getLastPathSegment() : "file.bin";

            if (currentPayload.length > 2 * 1024 * 1024) {
                Toast.makeText(this, "File > 2MB not allowed", Toast.LENGTH_LONG).show();
                currentPayload = null;
                return;
            }

            // Encode in Rust
            String encodeResult = PhotonNative.encodeData(encoderPtr.get(), currentPayload);
            Log.d(TAG, "Encoded: " + encodeResult);

            // Parse total frames
            totalFrames = parseJsonInt(encodeResult, "total_frames");
            if (totalFrames <= 0) totalFrames = 30;

            updatePayloadInfo(currentFileName + " • " + currentPayload.length + " bytes • " + totalFrames + " frames");
            progressBar.setMax(totalFrames);
            progressBar.setProgress(0);
            progressBar.setVisibility(ProgressBar.VISIBLE);

            statsText.setText("File loaded and encoded.\nReady to transmit.");

        } catch (Exception e) {
            Toast.makeText(this, "Failed to load file", Toast.LENGTH_SHORT).show();
            Log.e(TAG, "loadFile error", e);
        }
    }

    private int parseJsonInt(String json, String key) {
        try {
            String[] parts = json.split("\"" + key + "\":");
            if (parts.length > 1) {
                String val = parts[1].split("[,}]")[0].trim();
                return Integer.parseInt(val);
            }
        } catch (Exception ignored) {}
        return 0;
    }

    private void startRealTransmission() {
        if (currentPayload == null || encoderPtr.get() == 0) {
            Toast.makeText(this, "Pick a file first", Toast.LENGTH_SHORT).show();
            return;
        }

        isTransmitting = true;
        framesSent = 0;
        txStartTime = System.currentTimeMillis();
        btnStartTx.setText("STOP TX");
        progressBar.setProgress(0);

        executor.execute(() -> {
            for (int i = 0; i < totalFrames && isTransmitting; i++) {
                framesSent = i + 1;

                // Get real rendered frame from Rust (actual symbol grid)
                byte[] rgbData = PhotonNative.renderFrame(encoderPtr.get(), i, 800, 600);

                final int frameNum = i + 1;
                final int progress = (int) ((i + 1) * 100.0 / totalFrames);
                final long elapsedMs = System.currentTimeMillis() - txStartTime;
                final double throughput = elapsedMs > 0 ?
                        (currentPayload.length * 8.0 / 1000.0) / (elapsedMs / 1000.0) : 0;

                // Update UI
                mainHandler.post(() -> {
                    // Show the real optical pattern
                    if (rgbData != null && rgbData.length > 100) {
                        Bitmap bmp = createBitmapFromRgb(rgbData, 800, 600);
                        previewImage.setImageBitmap(bmp);
                        previewImage.setVisibility(ImageView.VISIBLE);
                    }

                    progressBar.setProgress(progress);

                    String analysis = String.format(
                            "TRANSMITTING\n\n" +
                            "Frame: %d / %d   Progress: %d%%\n" +
                            "Elapsed: %.1fs\n" +
                            "Throughput: %.1f kbps\n" +
                            "Payload: %s (%d B)\n" +
                            "Density: 24×18   Mode: RGB-4",
                            frameNum, totalFrames, progress,
                            elapsedMs / 1000.0, throughput,
                            currentFileName, currentPayload.length
                    );
                    statsText.setText(analysis);
                });

                try { Thread.sleep(95); } catch (InterruptedException ignored) {}
            }

            mainHandler.post(() -> {
                isTransmitting = false;
                btnStartTx.setText("START TX");
                if (framesSent >= totalFrames) {
                    statsText.append("\n\n✓ Transmission complete!");
                }
            });
        });
    }

    private Bitmap createBitmapFromRgb(byte[] rgb, int w, int h) {
        int[] pixels = new int[w * h];
        for (int i = 0; i < pixels.length; i++) {
            int r = rgb[i * 3] & 0xFF;
            int g = rgb[i * 3 + 1] & 0xFF;
            int b = rgb[i * 3 + 2] & 0xFF;
            pixels[i] = 0xFF000000 | (r << 16) | (g << 8) | b;
        }
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        bmp.setPixels(pixels, 0, w, 0, 0, w, h);
        return bmp;
    }

    private void startRealReceiving() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION);
            return;
        }

        isReceiving = true;
        framesDecoded = 0;
        checksumFails = 0;
        btnStartRx.setText("STOP RX");

        try {
            ProcessCameraProvider.getInstance(this).addListener(() -> {
                try {
                    cameraProvider = ProcessCameraProvider.getInstance(this).get();

                    ImageAnalysis analysis = new ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build();

                    analysis.setAnalyzer(executor, image -> {
                        if (!isReceiving) {
                            image.close();
                            return;
                        }

                        // Convert to byte array (YUV → simple grayscale for demo)
                        byte[] frameData = imageToByteArray(image);

                        String result = PhotonNative.processCameraFrame(
                                decoderPtr.get(),
                                frameData,
                                image.getWidth(),
                                image.getHeight()
                        );

                        framesDecoded++;
                        if (result.contains("false")) checksumFails++;

                        final String analysisResult = result;
                        final int fd = framesDecoded;

                        mainHandler.post(() -> {
                            long elapsed = System.currentTimeMillis() - txStartTime;
                            double rate = elapsed > 0 ? (fd * 240.0 * 8) / (elapsed / 1000.0) / 1000.0 : 0;

                            statsText.setText(String.format(
                                    "RECEIVING FROM CAMERA\n\n" +
                                    "Frames processed: %d\n" +
                                    "Checksum OK: %d   Fails: %d\n" +
                                    "Est. Rate: %.1f kbps\n\n" +
                                    "Analysis: %s",
                                    fd,
                                    fd - checksumFails, checksumFails,
                                    rate,
                                    analysisResult
                            ));
                        });

                        image.close();
                    });

                    CameraSelector selector = CameraSelector.DEFAULT_BACK_CAMERA;
                    cameraProvider.unbindAll();
                    cameraProvider.bindToLifecycle((LifecycleOwner) this, selector, analysis);

                    mainHandler.post(() -> {
                        statsText.setText("Camera RX active.\nPoint camera at transmitting screen.");
                    });

                } catch (Exception e) {
                    Log.e(TAG, "Camera start failed", e);
                }
            }, ContextCompat.getMainExecutor(this));

        } catch (Exception e) {
            Toast.makeText(this, "Camera error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private byte[] imageToByteArray(ImageProxy image) {
        // Simplified: take Y plane
        ByteBuffer yBuffer = image.getPlanes()[0].getBuffer();
        byte[] data = new byte[yBuffer.remaining()];
        yBuffer.get(data);
        return data;
    }

    private void stopEverything() {
        isTransmitting = false;
        isReceiving = false;

        if (cameraProvider != null) cameraProvider.unbindAll();

        btnStartTx.setText("START TX");
        btnStartRx.setText("START RX (CAMERA)");
        progressBar.setVisibility(ProgressBar.GONE);
        previewImage.setVisibility(ImageView.GONE);

        statsText.setText("Stopped. Ready.");
    }

    private void testRustCore() {
        if (encoderPtr.get() == 0) {
            encoderPtr.set(PhotonNative.createEncoder("medium", "rgb4"));
        }
        byte[] testData = "The optical channel is the message. Real encode/decode test.".getBytes();
        String res = PhotonNative.encodeData(encoderPtr.get(), testData);
        statsText.setText("Rust core test:\n" + res);
    }

    private void updatePayloadInfo(String text) {
        payloadInfo.setText(text);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Camera permission granted", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopEverything();
        if (encoderPtr.get() != 0) PhotonNative.destroyEncoder(encoderPtr.get());
        if (decoderPtr.get() != 0) PhotonNative.destroyDecoder(decoderPtr.get());
        executor.shutdown();
    }
}
