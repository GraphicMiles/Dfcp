/**
 * fft.js
 * Simple 2D spatial FFT for spectrum analysis of the received grid.
 * For experimental understanding of surviving frequencies.
 */

export class FFTAnalyzer {
  constructor() {
    this.history = [];
  }

  /**
   * Very lightweight 1D FFT approximation on rows or columns
   * (Full 2D FFT would be expensive in browser without WebGL)
   */
  analyzeSpatialFrequencies(imageData, geom) {
    if (!imageData || !geom) return { low: 0, mid: 0, high: 0 };

    const data = imageData.data;
    const W = imageData.width;

    // Sample luminance along a few rows/cols in the central grid area
    const samples = [];
    const startRow = Math.floor(geom.h * 0.25);
    const endRow = Math.floor(geom.h * 0.75);

    for (let row = startRow; row < endRow; row += 2) {
      for (let col = 2; col < geom.w - 2; col += 2) {
        const x = Math.floor(60 + col * geom.cellW);
        const y = Math.floor(60 + row * geom.cellH);
        const i = (y * W + x) * 4;
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        samples.push(lum);
      }
    }

    if (samples.length < 16) return { low: 0, mid: 0, high: 0 };

    // Simple frequency binning via differences
    let low = 0, mid = 0, high = 0;
    for (let i = 1; i < samples.length; i++) {
      const d = Math.abs(samples[i] - samples[i - 1]);
      if (d < 12) low++;
      else if (d < 45) mid++;
      else high++;
    }

    const total = low + mid + high || 1;
    const result = {
      low: (low / total),
      mid: (mid / total),
      high: (high / total),
      energy: Math.round((mid + high) / total * 100)
    };

    this.history.push(result);
    if (this.history.length > 40) this.history.shift();

    return result;
  }

  getAverageSpectrum() {
    if (!this.history.length) return { low: 0.6, mid: 0.3, high: 0.1 };
    let l = 0, m = 0, h = 0;
    for (let s of this.history) {
      l += s.low; m += s.mid; h += s.high;
    }
    const n = this.history.length;
    return { low: l / n, mid: m / n, high: h / n };
  }

  reset() { this.history = []; }
}
