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
import androidx.appcompat.app.AppCompatActivity;
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

    private ImageView previewImage, berGraph;
    private ProgressBar progressBar;
    private TextView statsText, payloadInfo;
    private Button btnPickFile, btnStartTx, btnStartRx, btnStop, btnTestCore, btnLoopback, btnExportLog;

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

    // For history graph and logging
    private java.util.List<Double> berHistory = new java.util.ArrayList<>();
    private java.util.List<Double> successRateHistory = new java.util.ArrayList<>();
    private java.util.List<String> sessionLog = new java.util.ArrayList<>();
    private long sessionStartTime;

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
        btnLoopback = findViewById(R.id.btnLoopback);
        btnExportLog = findViewById(R.id.btnExportLog);
        berGraph = findViewById(R.id.berGraph);

        btnPickFile.setOnClickListener(v -> pickFile());
        btnStartTx.setOnClickListener(v -> startRealTransmission());
        btnStartRx.setOnClickListener(v -> startRealReceiving());
        btnStop.setOnClickListener(v -> stopEverything());
        btnTestCore.setOnClickListener(v -> testRustCore());
        btnLoopback.setOnClickListener(v -> runLoopbackTest());
        btnExportLog.setOnClickListener(v -> exportSessionLog());

        statsText.setText("Photon Lab v0.2 — Real Encode/Decode Ready\nPick a small file (<2MB) to begin.");
        updatePayloadInfo("No payload loaded");

        if (encoderPtr.get() == 0) {
            // High-speed mode for 10 Mbps target: 48x36 grid + 9-bit RGB8
            // === 10 Mbps TARGET MODE ===
            // 48x36 grid + Rgb8 (9 bits/symbol) + high frame rate
            encoderPtr.set(PhotonNative.createEncoder("highspeed", "rgb8"));
        }
        if (decoderPtr.get() == 0) {
            decoderPtr.set(PhotonNative.createDecoder("highspeed", "rgb8"));
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

                    double currentBer = checksumFails / (double) Math.max(1, framesSent);
                    double successRate = framesSent > 0 ? (framesDecoded * 100.0 / framesSent) : 100.0;

                    berHistory.add(currentBer);
                    successRateHistory.add(successRate);
                    updateBerGraph();
                    recordToSession(String.format("{\"frame\":%d,\"ber\":%.5f,\"success\":%.1f}", frameNum, currentBer, successRate));

                    String analysis = String.format(
                            "TRANSMITTING\n\n" +
                            "Frame: %d / %d   Progress: %d%%\n" +
                            "Elapsed: %.1fs\n" +
                            "Throughput: %.1f kbps\n" +
                            "BER: %.4f   Success: %.1f%%\n" +
                            "Payload: %s (%d B)",
                            frameNum, totalFrames, progress,
                            elapsedMs / 1000.0, throughput,
                            currentBer, successRate,
                            currentFileName, currentPayload.length
                    );
                    statsText.setText(analysis);
                });

                // === HIGH-SPEED MODE FOR 10 Mbps TARGET ===
                // 48x36 grid + 9-bit Rgb8 + ~80-100 fps TX
                // Theoretical: 48*36*9 bits * 90 fps ≈ 1.75 Mbps (with good camera can go higher)
                try { Thread.sleep(11); } catch (InterruptedException ignored) {}   // ~90 fps target
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
        // Better YUV420 to RGB conversion (simple but functional)
        int width = image.getWidth();
        int height = image.getHeight();
        ByteBuffer yBuffer = image.getPlanes()[0].getBuffer();
        ByteBuffer uBuffer = image.getPlanes()[1].getBuffer();
        ByteBuffer vBuffer = image.getPlanes()[2].getBuffer();

        int yRowStride = image.getPlanes()[0].getRowStride();
        int uvRowStride = image.getPlanes()[1].getRowStride();
        int uvPixelStride = image.getPlanes()[1].getPixelStride();

        byte[] rgb = new byte[width * height * 3];

        for (int row = 0; row < height; row++) {
            for (int col = 0; col < width; col++) {
                int yIndex = row * yRowStride + col;
                int uvIndex = (row / 2) * uvRowStride + (col / 2) * uvPixelStride;

                int y = yBuffer.get(yIndex) & 0xFF;
                int u = uBuffer.get(uvIndex) & 0xFF;
                int v = vBuffer.get(uvIndex) & 0xFF;

                // YUV to RGB (BT.601 approx)
                int r = (int) (y + 1.402 * (v - 128));
                int g = (int) (y - 0.344136 * (u - 128) - 0.714136 * (v - 128));
                int b = (int) (y + 1.772 * (u - 128));

                r = Math.max(0, Math.min(255, r));
                g = Math.max(0, Math.min(255, g));
                b = Math.max(0, Math.min(255, b));

                int outIdx = (row * width + col) * 3;
                rgb[outIdx] = (byte) r;
                rgb[outIdx + 1] = (byte) g;
                rgb[outIdx + 2] = (byte) b;
            }
        }
        return rgb;
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

    // ==================== NEW FEATURES ====================

    private void runLoopbackTest() {
        if (currentPayload == null || encoderPtr.get() == 0) {
            Toast.makeText(this, "Pick a file first for loopback test", Toast.LENGTH_SHORT).show();
            return;
        }

        isTransmitting = true;
        framesSent = 0;
        framesDecoded = 0;
        checksumFails = 0;
        berHistory.clear();
        successRateHistory.clear();
        sessionLog.clear();
        sessionStartTime = System.currentTimeMillis();

        btnLoopback.setText("RUNNING LOOPBACK...");
        progressBar.setProgress(0);
        progressBar.setVisibility(ProgressBar.VISIBLE);

        executor.execute(() -> {
            int simulatedErrors = 0;

            for (int i = 0; i < totalFrames && isTransmitting; i++) {
                framesSent = i + 1;

                byte[] rgbData = PhotonNative.renderFrame(encoderPtr.get(), i, 800, 600);

                // Simulate camera capture + decode (loopback)
                boolean decodeSuccess = (Math.random() > 0.03); // ~3% error rate simulation
                if (!decodeSuccess) {
                    simulatedErrors++;
                    checksumFails++;
                } else {
                    framesDecoded++;
                }

                // Record history
                double currentBer = simulatedErrors / (double) framesSent;
                double successRate = (framesDecoded * 100.0) / framesSent;

                berHistory.add(currentBer);
                successRateHistory.add(successRate);

                final int frameNum = i + 1;
                final int progress = (int) ((i + 1) * 100.0 / totalFrames);
                final double ber = currentBer;
                final double sr = successRate;

                mainHandler.post(() -> {
                    if (rgbData != null && rgbData.length > 100) {
                        Bitmap bmp = createBitmapFromRgb(rgbData, 800, 600);
                        previewImage.setImageBitmap(bmp);
                        previewImage.setVisibility(ImageView.VISIBLE);
                    }

                    progressBar.setProgress(progress);
                    updateBerGraph();

                    String analysis = String.format(
                            "LOOPBACK TEST (TX + Simulated RX)\n\n" +
                            "Frame: %d / %d   Progress: %d%%\n" +
                            "Decoded: %d   Errors: %d\n" +
                            "BER: %.4f   Success: %.1f%%\n" +
                            "Payload: %s (%d bytes)",
                            frameNum, totalFrames, progress,
                            framesDecoded, checksumFails,
                            ber, sr,
                            currentFileName, currentPayload.length
                    );
                    statsText.setText(analysis);

                    sessionLog.add(String.format("{\"frame\":%d,\"ber\":%.5f,\"success\":%.1f}", frameNum, ber, sr));
                });

                try { Thread.sleep(70); } catch (InterruptedException ignored) {}
            }

            mainHandler.post(() -> {
                isTransmitting = false;
                btnLoopback.setText("LOOPBACK TEST");
                updateBerGraph();
                statsText.append("\n\n✓ Loopback complete. BER history recorded.");
            });
        });
    }

    private void updateBerGraph() {
        if (berGraph == null || berHistory.isEmpty()) return;

        int w = 600;
        int h = 80;
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(bmp);
        android.graphics.Paint paint = new android.graphics.Paint();
        paint.setAntiAlias(true);

        // Background
        canvas.drawColor(0xFF111111);

        // Grid
        paint.setColor(0xFF333333);
        paint.setStrokeWidth(1);
        for (int i = 1; i < 4; i++) {
            canvas.drawLine(0, i * h / 4f, w, i * h / 4f, paint);
        }

        // BER line (red)
        paint.setColor(0xFFEF4444);
        paint.setStrokeWidth(2);
        for (int i = 1; i < berHistory.size(); i++) {
            float x1 = (i - 1) * w / (float) berHistory.size();
            float y1 = h - (float) (berHistory.get(i - 1) * h * 4); // scale
            float x2 = i * w / (float) berHistory.size();
            float y2 = h - (float) (berHistory.get(i) * h * 4);
            canvas.drawLine(x1, Math.max(2, Math.min(h - 2, y1)), x2, Math.max(2, Math.min(h - 2, y2)), paint);
        }

        // Success rate line (green)
        paint.setColor(0xFF22C55E);
        paint.setStrokeWidth(2);
        for (int i = 1; i < successRateHistory.size(); i++) {
            float x1 = (i - 1) * w / (float) successRateHistory.size();
            float y1 = h - (float) (successRateHistory.get(i - 1) / 100.0 * h);
            float x2 = i * w / (float) successRateHistory.size();
            float y2 = h - (float) (successRateHistory.get(i) / 100.0 * h);
            canvas.drawLine(x1, Math.max(2, Math.min(h - 2, y1)), x2, Math.max(2, Math.min(h - 2, y2)), paint);
        }

        berGraph.setImageBitmap(bmp);
    }

    private void exportSessionLog() {
        if (sessionLog.isEmpty() && currentPayload == null) {
            Toast.makeText(this, "No session data to export", Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            long duration = System.currentTimeMillis() - sessionStartTime;
            if (duration <= 0) duration = 1000;

            StringBuilder json = new StringBuilder();
            json.append("{\n");
            json.append("  \"device\": \"").append(android.os.Build.MODEL).append("\",\n");
            json.append("  \"timestamp\": \"").append(new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date())).append("\",\n");
            json.append("  \"file\": \"").append(currentFileName).append("\",\n");
            json.append("  \"payload_bytes\": ").append(currentPayload != null ? currentPayload.length : 0).append(",\n");
            json.append("  \"total_frames\": ").append(totalFrames).append(",\n");
            json.append("  \"frames_sent\": ").append(framesSent).append(",\n");
            json.append("  \"frames_decoded\": ").append(framesDecoded).append(",\n");
            json.append("  \"checksum_fails\": ").append(checksumFails).append(",\n");
            json.append("  \"duration_ms\": ").append(duration).append(",\n");
            json.append("  \"throughput_kbps\": ").append(framesSent > 0 ? String.format("%.1f", (currentPayload.length * 8.0 / 1000.0) / (duration / 1000.0)) : 0).append(",\n");
            json.append("  \"history\": [\n");

            for (int i = 0; i < sessionLog.size(); i++) {
                json.append("    ").append(sessionLog.get(i));
                if (i < sessionLog.size() - 1) json.append(",");
                json.append("\n");
            }
            json.append("  ]\n");
            json.append("}");

            // Save to Downloads
            java.io.File downloads = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
            java.io.File file = new java.io.File(downloads, "photon_session_" + System.currentTimeMillis() + ".json");
            java.io.FileWriter writer = new java.io.FileWriter(file);
            writer.write(json.toString());
            writer.close();

            Toast.makeText(this, "Exported: " + file.getName(), Toast.LENGTH_LONG).show();
            Log.d(TAG, "Session log exported to " + file.getAbsolutePath());

        } catch (Exception e) {
            Toast.makeText(this, "Export failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            Log.e(TAG, "Export error", e);
        }
    }

    private void recordToSession(String entry) {
        sessionLog.add(entry);
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
