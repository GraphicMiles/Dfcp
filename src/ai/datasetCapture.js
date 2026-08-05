/**
 * datasetCapture.js
 * Captures training data for future AI models.
 * Stores (frame, labels, decoded, confidence, env)
 */

export class DatasetCapture {
  constructor() {
    this.dataset = [];
    this.enabled = false;
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; }

  capture(inputFrameDataUrl, expectedSymbols, decodedSymbols, confidence, environment = {}) {
    if (!this.enabled) return;
    this.dataset.push({
      id: 'ds_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
      frame: inputFrameDataUrl, // base64 png or reference path
      expected: expectedSymbols,
      decoded: decodedSymbols,
      confidence,
      env: environment
    });
  }

  exportDataset() {
    const blob = new Blob([JSON.stringify(this.dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `photon-ai-dataset-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return this.dataset.length;
  }

  getCount() { return this.dataset.length; }
  reset() { this.dataset = []; }
}
