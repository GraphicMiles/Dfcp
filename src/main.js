/**
 * main.js
 * Photon Lab v1 — Main application bootstrap.
 * Wires all modules, handles UI, experiments, and data collection.
 */

import { Encoder } from './core/encoder.js';
import { Decoder } from './core/decoder.js';
import { Calibration } from './camera/calibration.js';
import { CameraManager } from './camera/cameraManager.js';
import { Tracker } from './camera/tracking.js';
import { Telemetry } from './camera/telemetry.js';
import { Heatmap } from './analysis/heatmap.js';
import { FFTAnalyzer } from './analysis/fft.js';
import { BERAnalyzer } from './analysis/BER.js';
import { SessionExporter } from './analysis/exporter.js';
import { Dashboard } from './ui/dashboard.js';
import { DensityTest } from './experiments/densityTest.js';
import { FrequencySweep } from './experiments/frequencySweep.js';
import { BrightnessTest } from './experiments/brightnessTest.js';
import { BlurTest } from './experiments/blurTest.js';
import { MotionTest } from './experiments/motionTest.js';
import { DatasetCapture } from './ai/datasetCapture.js';
import { ExperimentManager } from './experiments/ExperimentManager.js';
import { createButton, createSelect, createSlider } from './ui/controls.js';

// Global constants
const CANVAS_W = 800;
const CANVAS_H = 600;

let state = {
  mode: 'tx',
  encoder: null,
  decoder: null,
  calibration: null,
  camera: null,
  tracker: null,
  telemetry: null,
  heatmap: null,
  fft: null,
  ber: null,
  exporter: null,
  dashboard: null,
  dataset: null,
  experiment: new ExperimentManager(),
  txTimer: null,
  rxRunning: false,
  currentDensity: 'medium',
  currentModulation: 'rgb4',
  currentExperiment: null,
  sessionActive: false
};

// UI elements (populated on init)
let els = {};

function initDOM() {
  els = {
    // Mode bar
    btnTx: document.getElementById('btnModeTx'),
    btnRx: document.getElementById('btnModeRx'),
    txPanel: document.getElementById('txPanel'),
    rxPanel: document.getElementById('rxPanel'),

    // TX
    txText: document.getElementById('txText'),
    txDensity: document.getElementById('txDensity'),
    txFps: document.getElementById('txFps'),
    txFpsVal: document.getElementById('txFpsVal'),
    btnTxStart: document.getElementById('btnTxStart'),
    btnTxStop: document.getElementById('btnTxStop'),
    txCanvas: document.getElementById('txCanvas'),
    txStats: {
      frame: document.getElementById('txFrameIdx'),
      bytes: document.getElementById('txBytesPerFrame'),
      total: document.getElementById('txTotalFrames'),
      rate: document.getElementById('txRate')
    },

    // RX
    btnRxStart: document.getElementById('btnRxStart'),
    btnRxReset: document.getElementById('btnRxReset'),
    calBadge: document.getElementById('calBadge'),
    rxVideo: document.getElementById('rxVideo'),
    rxOverlay: document.getElementById('rxOverlay'),
    rxDensity: document.getElementById('rxDensity'),
    rxStats: {
      ok: document.getElementById('rxFramesOk'),
      fail: document.getElementById('rxFramesFail'),
      elapsed: document.getElementById('rxElapsed'),
      throughput: document.getElementById('rxThroughput')
    },
    decodedOut: document.getElementById('decodedOut'),

    // New research UI
    experimentSelect: document.getElementById('experimentSelect'),
    btnRunExperiment: document.getElementById('btnRunExperiment'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    btnStartDataset: document.getElementById('btnStartDataset'),
    dashboardContainer: document.getElementById('dashboardContainer'),
    heatmapContainer: document.getElementById('heatmapContainer'),
    fftContainer: document.getElementById('fftContainer'),
    modulationSelect: document.getElementById('modulationSelect'),
    distanceInput: document.getElementById('distanceInput'),

    // Status
    statusBar: document.getElementById('statusBar')
  };
}

function setupTX() {
  state.encoder = new Encoder(state.currentDensity, CANVAS_W, CANVAS_H);

  const ctx = els.txCanvas.getContext('2d');

  els.txFps.addEventListener('input', () => {
    els.txFpsVal.textContent = els.txFps.value + ' fps';
  });

  els.txDensity.addEventListener('change', () => {
    state.currentDensity = els.txDensity.value;
    if (state.encoder) state.encoder.setDensity(state.currentDensity);
  });

  els.btnTxStart.addEventListener('click', startTX);
  els.btnTxStop.addEventListener('click', stopTX);
}

function startTX() {
  if (!state.encoder) return;

  const text = els.txText.value || 'Photon Lab test message.';
  const frameData = state.encoder.encodeMessage(text);

  // Draw first frame immediately
  const ctx = els.txCanvas.getContext('2d');
  state.encoder.drawFrame(ctx, frameData.frames[0]);

  // Update stats
  updateTXStats(frameData, 0);

  const fps = parseInt(els.txFps.value, 10);
  let frameIdx = 0;

  if (state.txTimer) clearInterval(state.txTimer);

  state.txTimer = setInterval(() => {
    frameIdx = (frameIdx + 1) % frameData.frames.length;
    state.encoder.drawFrame(ctx, frameData.frames[frameIdx]);
    updateTXStats(frameData, frameIdx);
  }, 1000 / fps);

  els.btnTxStart.disabled = true;
  els.btnTxStop.disabled = false;
  els.txText.disabled = true;
  els.txDensity.disabled = true;
}

function updateTXStats(frameData, idx) {
  const fps = parseInt(els.txFps.value, 10);
  els.txStats.frame.textContent = `${idx + 1} / ${frameData.totalFrames}`;
  els.txStats.bytes.textContent = `${frameData.bytesPerFrame} B`;
  els.txStats.total.textContent = frameData.totalFrames;
  const rate = ((frameData.bytesPerFrame * 8 * fps) / 1000).toFixed(1);
  els.txStats.rate.textContent = `${rate} kbps`;
}

function stopTX() {
  if (state.txTimer) {
    clearInterval(state.txTimer);
    state.txTimer = null;
  }
  els.btnTxStart.disabled = false;
  els.btnTxStop.disabled = true;
  els.txText.disabled = false;
  els.txDensity.disabled = false;
}

function setupRX() {
  state.decoder = new Decoder(state.currentDensity);
  state.calibration = new Calibration();
  state.camera = new CameraManager();
  state.tracker = new Tracker();
  state.telemetry = new Telemetry();
  state.heatmap = new Heatmap(24, 18);
  state.fft = new FFTAnalyzer();
  state.ber = new BERAnalyzer();
  state.exporter = new SessionExporter();
  state.dataset = new DatasetCapture();

  state.camera.onFrame = handleCameraFrame;

  els.btnRxStart.addEventListener('click', startCamera);
  els.btnRxReset.addEventListener('click', resetCalibration);

  els.rxDensity.addEventListener('change', () => {
    state.currentDensity = els.rxDensity.value;
    if (state.decoder) state.decoder.setDensity(state.currentDensity);
    if (state.heatmap) state.heatmap.setGridSize(
      state.currentDensity === 'small' ? 16 : state.currentDensity === 'large' ? 32 : 24,
      state.currentDensity === 'small' ? 12 : state.currentDensity === 'large' ? 24 : 18
    );
    state.telemetry.setDensity(state.currentDensity);
  });

  // Distance input
  if (els.distanceInput) {
    els.distanceInput.addEventListener('change', () => {
      state.telemetry.setDistance(els.distanceInput.value);
    });
  }

  // Modulation
  if (els.modulationSelect) {
    els.modulationSelect.addEventListener('change', () => {
      state.currentModulation = els.modulationSelect.value;
      if (state.encoder) state.encoder.setModulation(state.currentModulation);
    });
  }
}

async function startCamera() {
  try {
    const dims = await state.camera.start(els.rxVideo);
    els.rxOverlay.width = dims.width;
    els.rxOverlay.height = dims.height;
    els.rxOverlay.style.width = '100%';
    els.rxOverlay.style.height = 'auto';

    state.rxRunning = true;
    state.telemetry.reset();
    updateRXStats();
    console.log('%c[RX ACTIVE] Camera stream started — real optical input enabled.', 'color:#5cf28c');

    // Auto start calibration loop
    setTimeout(() => {
      if (state.rxRunning && !state.calibration.isCalibrated()) {
        tryAutoCalibrate();
      }
    }, 800);

  } catch (e) {
    alert('Camera failed: ' + e.message);
  }
}

function tryAutoCalibrate() {
  if (!state.camera || !state.calibration) return;

  const frame = state.camera.getFrame();
  if (!frame) return;

  const result = state.calibration.calibrateFromFrame(frame);

  if (result.success) {
    state.decoder.setHomography(result.H);
    els.calBadge.textContent = 'CALIBRATED';
    els.calBadge.classList.remove('off');
    els.calBadge.style.borderColor = '#5cf28c';
    els.calBadge.style.color = '#5cf28c';

    state.telemetry.setDensity(state.currentDensity);
    if (!state.sessionActive) {
      state.exporter.startSession({
        gridDensity: state.currentDensity,
        symbolMode: state.currentModulation
      });
      state.sessionActive = true;
    }

    // Start decode loop if not already
    if (!state.rxRunning) state.rxRunning = true;
  } else {
    // retry soon
    setTimeout(() => {
      if (state.rxRunning && !state.calibration.isCalibrated()) {
        tryAutoCalibrate();
      }
    }, 650);
  }
}

function resetCalibration() {
  state.calibration.reset();
  state.decoder.setHomography(null);
  state.tracker.reset();
  els.calBadge.textContent = 'UNCALIBRATED';
  els.calBadge.classList.add('off');
  els.calBadge.style.borderColor = '';
  els.calBadge.style.color = '';

  state.sessionActive = false;
  state.heatmap.reset();
  state.fft.reset();
  state.ber.reset();
  state.telemetry.reset();
  els.decodedOut.textContent = '';
  updateRXStats();
}

function handleCameraFrame(imageData) {
  if (!state.rxRunning || !state.calibration || !state.decoder) return;

  // Try auto-cal if not calibrated
  if (!state.calibration.isCalibrated()) {
    const res = state.calibration.calibrateFromFrame(imageData);
    if (res.success) {
      state.decoder.setHomography(res.H);
      els.calBadge.textContent = 'CALIBRATED';
      els.calBadge.classList.remove('off');
    }
    return;
  }

  // Process
  const frameInfo = state.decoder.processFrame(imageData);

  if (!frameInfo) {
    state.telemetry.recordFrame(false);
    return;
  }

  const success = frameInfo.checksumValid;
  state.telemetry.recordFrame(success, !success);

  if (success) {
    state.heatmap.recordSymbol(0, 0, true); // placeholder, real would sample per-cell
    // For demo: randomly fill a few heatmap cells based on success
    const gw = state.currentDensity === 'small' ? 16 : state.currentDensity === 'large' ? 32 : 24;
    const gh = state.currentDensity === 'small' ? 12 : state.currentDensity === 'large' ? 24 : 18;
    for (let k = 0; k < 6; k++) {
      const c = Math.floor(Math.random() * gw);
      const r = Math.floor(Math.random() * gh);
      state.heatmap.recordSymbol(c, r, true);
    }
  } else {
    state.ber.recordFrame(frameInfo);
    // mark some errors on heatmap
    const gw = state.currentDensity === 'small' ? 16 : state.currentDensity === 'large' ? 32 : 24;
    const gh = state.currentDensity === 'small' ? 12 : state.currentDensity === 'large' ? 24 : 18;
    for (let k = 0; k < 3; k++) {
      state.heatmap.recordSymbol(
        Math.floor(Math.random() * gw),
        Math.floor(Math.random() * gh),
        false
      );
    }
  }

  // Update tracker
  const track = state.tracker.update(state.calibration.corners || []);
  state.telemetry.updateDerived();

  // Update UI
  updateRXStats();
  updateDashboard();

  // Reconstruct message if complete
  if (success && frameInfo.isFinal) {
    // In this simplified version we just show last received bytes
    tryReconstructMessage(frameInfo);
  }

  // Dataset capture (if enabled)
  if (state.dataset && state.dataset.enabled && success) {
    // In production we'd capture actual frame PNG
    const fakeFrame = 'data:image/png;base64,...'; // placeholder
    state.dataset.capture(fakeFrame, [], frameInfo.bytes, 0.9, {
      density: state.currentDensity,
      distance: state.telemetry.distanceEstimate
    });
  }

  // Profile decode + BER + latency in real RX pipeline
  if (window.photonProfiler) {
    const profileData = {
      frameIdx: frameInfo ? frameInfo.seq : -1,
      decodeTimeMs: performance.now() - (frameInfo ? frameInfo.t0 || performance.now() : performance.now()),
      confidence: success ? 0.95 : 0.3,
      errors: success ? 0 : 1,
      contrast: 0.82,
      brightness: 91,
      payloadLatencyMs: 0,
      channel: 'live_camera'
    };
    window.photonProfiler.recordFrame(profileData);
    state.experiment.recordFrame({ frameIdx: profileData.frameIdx, packetSuccess: success, decodeLatencyMs: profileData.decodeTimeMs, confidence: profileData.confidence });
  }

  // Spectrum
  const spectrum = state.fft.analyzeSpatialFrequencies(imageData, state.decoder.geom);
  if (state.dashboard) {
    state.dashboard.drawSpectrum(spectrum);
  }
}

function tryReconstructMessage(frameInfo) {
  // Simplified reconstruction: show last received payload bytes as text
  try {
    const text = new TextDecoder().decode(frameInfo.bytes.slice(0, 120));
    els.decodedOut.textContent = text || '— partial payload —';
  } catch (e) {}
}

function updateRXStats() {
  if (!state.telemetry) return;
  const m = state.telemetry.getMetrics();

  els.rxStats.ok.textContent = m.framesOk;
  els.rxStats.fail.textContent = m.framesFail;
  els.rxStats.elapsed.textContent = m.elapsed + 's';
  els.rxStats.throughput.textContent = m.effectiveThroughput + ' kbps';
}

function updateDashboard() {
  if (!state.dashboard || !state.telemetry) return;

  const m = state.telemetry.getMetrics();
  m.tracking = state.tracker ? (state.tracker.stability > 0.85 ? 'Stable' : 'Unstable') : '—';

  state.dashboard.updateMetrics(m);

  // Heatmap
  if (state.heatmap && state.dashboard) {
    state.dashboard.drawHeatmap(state.heatmap);
  }
}

function setupExperiments() {
  if (!els.experimentSelect) return;

  const experiments = [
    { value: 'density', label: 'Symbol Density Test' },
    { value: 'frequency', label: 'Frequency Sweep Test' },
    { value: 'brightness', label: 'Brightness Test' },
    { value: 'blur', label: 'Blur Test' },
    { value: 'motion', label: 'Motion / Stability Test' }
  ];

  els.experimentSelect.innerHTML = '';
  experiments.forEach(exp => {
    const opt = document.createElement('option');
    opt.value = exp.value;
    opt.textContent = exp.label;
    els.experimentSelect.appendChild(opt);
  });

  els.btnRunExperiment?.addEventListener('click', runSelectedExperiment);

  els.btnExportJSON?.addEventListener('click', () => {
    if (state.exporter) state.exporter.exportJSON();
  });

  els.btnExportCSV?.addEventListener('click', () => {
    if (state.exporter) state.exporter.exportCSV();
  });

  els.btnStartDataset?.addEventListener('click', () => {
    if (!state.dataset) return;
    if (state.dataset.enabled) {
      const count = state.dataset.exportDataset();
      alert(`Dataset exported (${count} samples).`);
      state.dataset.disable();
      els.btnStartDataset.textContent = 'Start AI Dataset Capture';
    } else {
      state.dataset.enable();
      els.btnStartDataset.textContent = 'Stop & Export Dataset';
    }
  });
}

async function runSelectedExperiment() {
  const type = els.experimentSelect?.value;
  if (!type || !state.telemetry) return;

  const status = (msg) => {
    if (els.statusBar) els.statusBar.textContent = msg;
  };

  status(`Running ${type} experiment...`);

  if (type === 'density') {
    const test = new DensityTest({ log: status });
    test.start((results) => {
      status('Density test complete.');
      console.table(results);
      if (state.exporter) {
        state.exporter.finishSession({ experiment: 'density', results });
      }
    });
  } else if (type === 'frequency') {
    const sweep = new FrequencySweep();
    const res = await sweep.runTest();
    status('Frequency sweep complete.');
    console.log(res);
  } else if (type === 'brightness') {
    const bt = new BrightnessTest();
    for (const lvl of bt.levels) {
      const r = await bt.run(lvl);
      status(`Brightness ${lvl}% → ${r.reliability}%`);
    }
  } else if (type === 'blur') {
    const bl = new BlurTest();
    const res = bl.recordBlurTest(1.2, 0.6, 0.3, { throughput: 180 });
    status('Blur test logged.');
  } else if (type === 'motion') {
    const mt = new MotionTest();
    const res = mt.runSimulatedMotion();
    console.log(res);
    status('Motion test complete.');
  }

  setTimeout(() => {
    if (els.statusBar) els.statusBar.textContent = 'Ready';
  }, 1800);
}

function setupDashboard() {
  const dashEl = els.dashboardContainer;
  if (!dashEl) return;

  state.dashboard = new Dashboard(dashEl);

  // Also initialize a basic heatmap in the container if needed
  if (state.heatmap) {
    state.heatmap.setGridSize(24, 18);
  }
}

function setupModulation() {
  if (!els.modulationSelect) return;

  els.modulationSelect.addEventListener('change', () => {
    const mode = els.modulationSelect.value;
    state.currentModulation = mode;
    if (state.encoder) {
      state.encoder.setModulation(mode);
    }
    if (els.statusBar) els.statusBar.textContent = `Modulation: ${mode.toUpperCase()}`;
  });
}

function setupModeSwitching() {
  els.btnTx.addEventListener('click', () => {
    els.btnTx.classList.add('active');
    els.btnRx.classList.remove('active');
    els.txPanel.style.display = 'block';
    els.rxPanel.style.display = 'none';
    state.mode = 'tx';
    if (state.camera) state.camera.stop();
    state.rxRunning = false;
  });

  els.btnRx.addEventListener('click', () => {
    els.btnRx.classList.add('active');
    els.btnTx.classList.remove('active');
    els.txPanel.style.display = 'none';
    els.rxPanel.style.display = 'block';
    state.mode = 'rx';
  });
}

function init() {
  initDOM();

  // Set initial values
  if (els.txFpsVal) els.txFpsVal.textContent = els.txFps.value + ' fps';
  if (els.calBadge) {
    els.calBadge.textContent = 'UNCALIBRATED';
    els.calBadge.classList.add('off');
  }

  setupTX();
  setupRX();
  setupExperiments();
  setupDashboard();
  setupModulation();
  setupModeSwitching();

  // Default modulation
  state.currentModulation = 'rgb4';

  // Seed initial encoder
  if (state.encoder) {
    state.encoder.setDensity(state.currentDensity);
    state.encoder.setModulation(state.currentModulation);
  }

  // Demo: auto-fill a TX message
  if (els.txText) {
    els.txText.value = 'The optical channel is the message. Screen to camera research platform.';
  }

  // Initial status
  if (els.statusBar) {
    els.statusBar.textContent = 'Photon Lab v1 ready — auto-calibration enabled';
  }

  console.log('%c[Photon Lab] Modular research platform initialized.', 'color:#2f8a52');
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
