/**
 * BER.js
 * Bit Error Rate calculation and history.
 */

export class BERAnalyzer {
  constructor() {
    this.totalBits = 0;
    this.errorBits = 0;
    this.history = [];
  }

  recordFrame(frameInfo, expectedBytes = null) {
    // If we have expected, we can compute exact BER
    // For now we use checksum failure as proxy
    const bitsPerFrame = 6 * 428; // approx
    this.totalBits += bitsPerFrame;

    if (!frameInfo.checksumValid) {
      // Assume ~1-3% bit errors on failure
      this.errorBits += Math.round(bitsPerFrame * 0.015);
    }

    const ber = this.totalBits > 0 ? this.errorBits / this.totalBits : 0;
    this.history.push(ber);
    if (this.history.length > 200) this.history.shift();

    return ber;
  }

  getCurrentBER() {
    return this.totalBits > 0 ? this.errorBits / this.totalBits : 0;
  }

  getAverageBER(window = 30) {
    if (!this.history.length) return 0;
    const slice = this.history.slice(-window);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  reset() {
    this.totalBits = 0;
    this.errorBits = 0;
    this.history = [];
  }
}
