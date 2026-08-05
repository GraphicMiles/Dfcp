/**
 * labeling.js
 * Simple auto-labeling utilities for captured frames.
 */

export function autoLabelSymbols(symbolValues, confidenceThreshold = 0.7) {
  // In real system this would use model output
  return symbolValues.map((v, idx) => ({
    index: idx,
    value: v,
    confidence: 0.85 + Math.random() * 0.12
  }));
}

export function generateLabelJSON(frameMeta, symbols) {
  return {
    version: 1,
    frameMeta,
    symbols,
    created: Date.now()
  };
}
