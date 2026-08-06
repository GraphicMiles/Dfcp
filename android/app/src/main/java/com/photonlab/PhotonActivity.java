package com.photonlab;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.os.Bundle;
import android.util.Log;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.concurrent.atomic.AtomicLong;

public class PhotonActivity extends Activity {
    private static final String TAG = "PhotonLab";
    private static final int CAMERA_PERMISSION_REQUEST = 100;

    private SurfaceView surfaceView;
    private TextView statusText;
    private Button btnStartTx, btnStartRx, btnTestCore;

    private AtomicLong encoderPtr = new AtomicLong(0);
    private boolean isTransmitting = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_photon);

        surfaceView = findViewById(R.id.surfaceView);
        statusText = findViewById(R.id.statusText);
        btnStartTx = findViewById(R.id.btnStartTx);
        btnStartRx = findViewById(R.id.btnStartRx);
        btnTestCore = findViewById(R.id.btnTestCore);

        btnTestCore.setOnClickListener(v -> testRustCore());

        btnStartTx.setOnClickListener(v -> {
            if (encoderPtr.get() == 0) {
                encoderPtr.set(PhotonNative.createEncoder("medium", "rgb4"));
            }
            startTransmission();
        });

        btnStartRx.setOnClickListener(v -> {
            if (checkCameraPermission()) {
                startCameraReceiver();
            } else {
                requestCameraPermission();
            }
        });

        statusText.setText("Photon Lab Native v0.1 — Rust Core Ready");
    }

    private void testRustCore() {
        if (encoderPtr.get() == 0) {
            encoderPtr.set(PhotonNative.createEncoder("medium", "rgb4"));
        }

        String result = PhotonNative.encodeMessage(encoderPtr.get(), "Hello from Android + Rust!");
        statusText.setText("Rust core test:\n" + result);
        Log.d(TAG, "Rust result: " + result);
    }

    private void startTransmission() {
        isTransmitting = !isTransmitting;
        btnStartTx.setText(isTransmitting ? "STOP TX" : "START TX");

        if (isTransmitting && encoderPtr.get() != 0) {
            String msg = "Photon native test message from Android";
            String encoded = PhotonNative.encodeMessage(encoderPtr.get(), msg);
            statusText.setText("TX started\n" + encoded);

            // Simple render loop (demo)
            new Thread(() -> {
                int frame = 0;
                while (isTransmitting) {
                    String renderInfo = PhotonNative.renderFrame(encoderPtr.get(), frame++);
                    final int currentFrame = frame;  // Create final reference for lambda
                    runOnUiThread(() -> {
                        if (statusText != null) {
                            statusText.setText("Frame " + currentFrame + "\n" + renderInfo);
                        }
                    });
                    try { Thread.sleep(120); } catch (InterruptedException ignored) {}
                }
            }).start();
        }
    }

    private void startCameraReceiver() {
        statusText.setText("Camera RX mode started (placeholder)\n" +
                "Real Camera2 + Rust decoder integration coming next.");
        Toast.makeText(this, "RX mode - integrate Camera2 + JNI decoder here", Toast.LENGTH_LONG).show();

        // TODO: Implement real camera preview + call into Rust decoder
    }

    private boolean checkCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void requestCameraPermission() {
        ActivityCompat.requestPermissions(this,
                new String[]{Manifest.permission.CAMERA},
                CAMERA_PERMISSION_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startCameraReceiver();
            } else {
                Toast.makeText(this, "Camera permission required for RX", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (encoderPtr.get() != 0) {
            PhotonNative.destroyEncoder(encoderPtr.get());
        }
    }
}
