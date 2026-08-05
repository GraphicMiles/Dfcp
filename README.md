# Photon Lab v1 — Optical Communication Research Test Bench

Upgraded from the original single-file PHOTON prototype into a modular research platform for characterizing real-world screen → camera optical channels.

See the brief for goals and requirements.

## Quick Start

1. Open `index.html` in a modern browser (Chrome recommended).
2. Use **TX** tab to generate and transmit symbol grids (or open on a second screen/device).
3. Use **RX** tab on the receiving device + camera.
4. Auto-calibration detects magenta markers automatically.
5. Run experiments from the Experiment panel.
6. View live dashboard, heatmaps, FFT, and export sessions.

## Project Structure

```
photon-lab/
├── index.html
├── src/
│   ├── core/
│   │   ├── encoder.js
│   │   ├── decoder.js
│   │   ├── packet.js
│   │   ├── modulation.js
│   │   ├── checksum.js
│   │   └── homography.js
│   ├── camera/
│   │   ├── cameraManager.js
│   │   ├── calibration.js
│   │   ├── markerDetection.js
│   │   ├── tracking.js
│   │   └── telemetry.js
│   ├── experiments/
│   │   ├── frequencySweep.js
│   │   ├── densityTest.js
│   │   ├── ...
│   ├── analysis/
│   │   ├── BER.js
│   │   ├── SNR.js
│   │   ├── heatmap.js
│   │   ├── fft.js
│   │   └── exporter.js
│   ├── ai/
│   │   ├── datasetCapture.js
│   │   └── labeling.js
│   ├── ui/
│   │   ├── dashboard.js
│   │   ├── charts.js
│   │   └── controls.js
│   └── main.js
├── dataset/          # captured frames + labels
└── docs/
```

## Features Implemented

- Modular clean architecture
- Automatic calibration (magenta marker detection + homography)
- Research dashboard with channel metrics (BER, SNR, throughput, etc.)
- Experiment recording + JSON/CSV export
- Experiment modes: Density, Frequency Sweep, Brightness, Blur, Motion
- Heatmap visualization (live reliability map)
- Optical spectrum / FFT analysis
- Multiple modulation modes (RGB4, RGB8, Mono, Spatial, Analog)
- AI dataset preparation hooks
- Native-migration ready (pure logic separated from DOM/camera)

## Usage Notes

- Designed as an instrument: data collection first.
- Run TX on one display/device, RX + camera on another.
- For single-device testing use the built-in loopback simulation option.
- All data is local; export sessions for analysis/AI.

## Future

Hooks for rolling shutter, learned codecs, etc. are present.

## Credits

Refactored from original PHOTON prototype.
