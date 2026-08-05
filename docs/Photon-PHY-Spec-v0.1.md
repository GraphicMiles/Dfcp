# Photon Physical Layer (PHY) Specification v0.1

**Status:** Draft — Experimental  
**Date:** 2026-08-06  
**Authors:** GraphicMiles Research  
**Version:** 0.1 (Browser Characterization Baseline)

---

## 1. Purpose

This document defines the baseline assumptions, symbol encoding, framing, and receiver requirements for the Photon optical screen-to-camera physical layer. It is intended to evolve alongside experimental data collected from Photon Lab.

The goal is **not** to claim a finished protocol, but to create a living specification that:

- Captures current experimental understanding of the real screen-camera channel
- Allows consistent comparison across experiments
- Provides a target for native implementations (Camera2 / AVFoundation)
- Serves as the foundation for higher-layer protocol work

---

## 2. Optical Channel Model (Current Assumptions)

| Parameter                  | Assumed Range (Commodity Devices) | Notes |
|---------------------------|-----------------------------------|-------|
| Effective symbol rate     | 5–30 symbols/s (per cell)        | Limited by screen refresh + camera frame rate |
| Spatial frequency cutoff  | ~0.3–0.6 cycles per pixel        | To be measured via frequency sweep |
| Channel noise             | Quantization + motion blur + lens distortion + rolling shutter skew | Dominant impairments |
| Color channel independence| Moderate (R/G/B bleed exists)    | Independent modulation is promising but requires validation |
| Perspective distortion    | Significant                      | Requires continuous homography / tracking |
| Typical usable distance   | 15–80 cm                         | Depends on screen size and camera quality |
| Lighting sensitivity      | High                             | Ambient light and screen brightness interact strongly |

**Key Principle:** All design decisions must be validated by real channel measurements before being declared "load-bearing".

---

## 3. Symbol Definition (v0.1 Baseline)

### 3.1 Modulation Modes

| Mode       | Bits per cell | Description                              | Status     |
|------------|---------------|------------------------------------------|------------|
| RGB-4      | 6             | 4 intensity levels per R/G/B channel     | Implemented |
| RGB-8      | 9             | 8 intensity levels per channel           | Implemented |
| Monochrome | 2–3           | Intensity only (luminance modulation)    | Implemented |
| Spatial    | 2–4           | High-contrast spatial patterns           | Implemented |
| Analog     | Variable      | Continuous waveform (future)             | Experimental hook |

**Current default:** RGB-4 (6 bits/cell)

### 3.2 Symbol Grid

- Rectangular grid of cells
- Supported densities (v0.1): 16×12, 24×18, 32×24, 48×36, 64×48
- Each cell maps to one symbol value

### 3.3 Corner Markers

- Four solid magenta squares (RGB 255,0,255)
- Size: ~40 px on 800×600 canvas (scales with resolution)
- Used for automatic detection and homography

---

## 4. Frame Structure

### 4.1 Per-Frame Header (4 cells)

| Cell | Bits | Field          | Description |
|------|------|----------------|-------------|
| 0    | 6    | `idx_low`      | Frame index low bits |
| 1    | 6    | `idx_high`     | Frame index high bits |
| 2    | 6    | `flags`        | 0 = data frame, 63 = final frame |
| 3    | 6    | `checksum`     | 6-bit checksum of payload bytes |

**Frame index** = `idx_low | (idx_high << 6)`

### 4.2 Payload

- Remaining cells carry packed symbol data
- Bit packing depends on modulation mode (6-bit or 9-bit symbols)
- Message length prefix (4 bytes) is sent in the first frame(s)

### 4.3 Checksum

Simple 6-bit additive checksum:
```js
checksum = 0
for (byte in payload) checksum = (checksum + byte) & 0x3f
```

---

## 5. Synchronization

### 5.1 Visual Sync

- Corner markers provide coarse spatial sync
- Frame index in header provides temporal sync

### 5.2 Future Enhancements (v0.2+)

- Dedicated synchronization preamble patterns
- Per-row timing markers for rolling-shutter demodulation
- Pilot symbols for channel estimation

---

## 6. Error Detection & Correction (v0.1)

- Per-frame checksum (detection only)
- No forward error correction yet
- Future candidates:
  - Reed-Solomon / BCH over frames
  - Fountain codes (rateless)
  - Learned error correction (DeepJSCC style)

---

## 7. Receiver Requirements

### 7.1 Minimum (Browser Baseline)

- Color camera feed (≥720p)
- 4-point homography correction
- Per-cell sampling after perspective warp
- Nearest-neighbor quantization to symbol levels

### 7.2 Target (Native)

- Raw sensor access (Camera2 / AVFoundation)
- Manual exposure + white balance lock
- High frame rate capture (≥60 fps preferred)
- Access to rolling shutter timing information
- Per-row or sub-frame sampling capability

---

## 8. Performance Metrics (to be measured)

- Bit Error Rate (BER)
- Packet Error Rate (PER)
- Effective goodput (kbps)
- Spatial reliability map (heatmap)
- Modulation Transfer Function (MTF) via frequency sweep
- Tracking stability under motion
- Recovery time after loss of lock

---

## 9. Capability Negotiation (Future)

For multi-device / future protocol versions:

- Supported modulation modes
- Maximum reliable grid density
- Native vs browser capability flags
- Rolling-shutter support indicator

---

## 10. Current Experimental Gaps (to be filled by Photon Lab)

- [ ] Precise spatial frequency response curve
- [ ] Quantitative benefit of independent R/G/B modulation
- [ ] Impact of rolling shutter skew on symbol error
- [ ] Real-world raw sensor vs. compressed preview comparison
- [ ] Effect of screen brightness + ambient light interaction
- [ ] Motion / vibration tolerance envelope

---

## 11. Versioning & Evolution

- v0.1: Browser-based RGB grid baseline (current)
- v0.2: Add native raw access hooks + rolling shutter experiments
- v0.3: Define analog/continuous modulation symbols
- v1.0: First stable PHY with measured performance envelope

---

**This document is intentionally conservative.** All claims must be backed by data collected from real devices using Photon Lab or its native successors.

---

*End of Photon PHY Specification v0.1*
