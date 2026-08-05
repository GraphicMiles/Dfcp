/**
 * SNR.js
 * Rough SNR estimation from symbol contrast.
 */

export class SNRAnalyzer {
  constructor() {
    this.samples = [];
  }

  estimateFromSymbols(symbols, levels) {
    if (!symbols || symbols.length < 10) return 20;

    // Compute contrast: variance of symbol values normalized
    const mean = symbols.reduce((a, b) => a + b, 0) / symbols.length;
    let variance = 0;
    for (let s of symbols) variance += Math.pow(s - mean, 2);
    variance /= symbols.length;

    // Very rough SNR proxy in dB
    const snr = Math.max(5, Math.min(45, 10 + variance * 0.6));
    this.samples.push(snr);
    if (this.samples.length > 50) this.samples.shift();
    return snr;
  }

  getAverage() {
    if (!this.samples.length) return 22;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  reset() { this.samples = []; }
}
