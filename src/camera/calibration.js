/**
 * calibration.js
 * Automatic calibration pipeline.
 * Camera frame -> HSV -> Magenta detection -> 4 corners -> Homography
 */

import { detectMagentaMarkers, refineMarkerCenters } from './markerDetection.js';
import { computeHomography, orderCorners } from '../core/homography.js';

export class Calibration {
  constructor() {
    this.H = null;
    this.corners = null; // [TL,TR,BR,BL]
    this.calibrated = false;
    this.lastDetection = null;
  }

  /**
   * Run full auto-calibration on an ImageData frame.
   * Returns { success, corners, H } or { success: false }
   */
  calibrateFromFrame(imageData) {
    if (!imageData || !imageData.data) return { success: false };

    const W = imageData.width;
    const H = imageData.height;

    let detected = detectMagentaMarkers(imageData, W, H, {
      minArea: 280,
      maxArea: 12000
    });

    if (!detected || detected.length < 4) {
      // Try fallback with looser params
      detected = detectMagentaMarkers(imageData, W, H, {
        minArea: 120,
        maxArea: 15000,
        hueTol: 35
      });
    }

    if (!detected || detected.length < 4) {
      this.calibrated = false;
      return { success: false, reason: 'markers-not-found' };
    }

    // Refine centers
    const refined = refineMarkerCenters(imageData, detected, 26);

    // Order as TL, TR, BR, BL
    const ordered = orderCorners(refined);

    // Reference points on the TX canvas (fixed)
    const srcPoints = [
      { x: 30, y: 30 },
      { x: 770, y: 30 },
      { x: 770, y: 570 },
      { x: 30, y: 570 }
    ];

    const Hmat = computeHomography(srcPoints, ordered);

    this.corners = ordered;
    this.H = Hmat;
    this.calibrated = true;
    this.lastDetection = { corners: ordered, timestamp: Date.now() };

    return {
      success: true,
      corners: ordered,
      H: Hmat
    };
  }

  getHomography() {
    return this.H;
  }

  isCalibrated() {
    return this.calibrated;
  }

  reset() {
    this.H = null;
    this.corners = null;
    this.calibrated = false;
    this.lastDetection = null;
  }
}
