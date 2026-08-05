/**
 * telemetry.js
 * Collects and exposes channel telemetry data.
 */

export class Telemetry {
  constructor() {
    this.reset();
  }

  reset() {
    this.framesProcessed = 0;
    this.framesDecoded = 0;
    this.checksumErrors = 0;
    this.startTime = performance.now();
    this.lastUpdate = this.startTime;
    this.throughputHistory = [];
    this.berHistory = [];
    this.currentBER = 0;
    this.estimatedSNR = 0;
    this.distanceEstimate = 0.8; // meters, user editable
    this.gridDensity = 'medium';
    this.symbolRate = 0;
    this.effectiveRate = 0;
    this.packetSuccessRate = 100;
    this.quality = 0;
  }

  recordFrame(success, checksumFail = false) {
    this.framesProcessed++;
    if (success) this.framesDecoded++;
    if (checksumFail) this.checksumErrors++;

    const now = performance.now();
    if (now - this.lastUpdate > 250) {
      this.updateDerived();
      this.lastUpdate = now;
    }
  }

  updateDerived() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    if (elapsed < 0.1) return;

    const fps = this.framesProcessed / elapsed;
    this.symbolRate = fps * 432; // rough, depends on density

    // BER estimate
    const totalBits = this.framesDecoded * 6 * 428; // rough payload cells
    if (totalBits > 0) {
      this.currentBER = this.checksumErrors / Math.max(1, this.framesDecoded + this.checksumErrors);
    }

    this.packetSuccessRate = this.framesDecoded > 0
      ? (this.framesDecoded / (this.framesDecoded + this.checksumErrors)) * 100
      : 100;

    // Very rough SNR proxy: inverse of BER
    this.estimatedSNR = this.currentBER > 0 ? Math.max(0, -20 * Math.log10(this.currentBER)) : 35;

    // Quality score 0-100
    this.quality = Math.max(0, Math.min(100,
      (this.packetSuccessRate * 0.6) +
      ((100 - Math.min(100, this.currentBER * 10000)) * 0.25) +
      (Math.min(100, this.estimatedSNR) * 0.15)
    ));

    // Throughput estimate (placeholder until full packet reconstruction)
    const kbps = (this.framesDecoded * 240 * 8) / (elapsed * 1000);
    this.effectiveRate = Math.max(0, kbps);

    this.throughputHistory.push(this.effectiveRate);
    if (this.throughputHistory.length > 60) this.throughputHistory.shift();

    this.berHistory.push(this.currentBER);
    if (this.berHistory.length > 60) this.berHistory.shift();
  }

  getMetrics() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    return {
      fps: this.framesProcessed / Math.max(0.1, elapsed),
      decodeFps: this.framesDecoded / Math.max(0.1, elapsed),
      distance: this.distanceEstimate,
      gridDensity: this.gridDensity,
      symbolRate: Math.round(this.symbolRate),
      effectiveThroughput: this.effectiveRate.toFixed(1),
      packetSuccess: this.packetSuccessRate.toFixed(1),
      ber: this.currentBER.toExponential(2),
      snr: this.estimatedSNR.toFixed(1),
      quality: Math.round(this.quality),
      elapsed: elapsed.toFixed(1),
      framesOk: this.framesDecoded,
      framesFail: this.checksumErrors
    };
  }

  setDistance(meters) {
    this.distanceEstimate = parseFloat(meters) || 0.8;
  }

  setDensity(d) {
    this.gridDensity = d;
  }
}
