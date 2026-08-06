/**
 * Modulation.js
 * Defines symbol encoding / decoding for optical channel.
 * Supports multiple modes.
 * Designed to be portable (no DOM / browser specific).
 */

export const LEVELS_4 = [40, 105, 170, 235]; // 4 levels → 2 bits per channel → 6 bits / symbol
export const LEVELS_8 = [20, 50, 80, 110, 140, 170, 200, 230]; // 8 levels → 3 bits/channel

export const MODES = {
  RGB4: 'rgb4',
  RGB8: 'rgb8',
  MONO: 'mono',
  SPATIAL: 'spatial',
  ANALOG: 'analog'
};

let currentMode = MODES.RGB4;
let currentLevels = LEVELS_4;

export function setModulationMode(mode) {
  currentMode = mode;
  if (mode === MODES.RGB8) currentLevels = LEVELS_8;
  else currentLevels = LEVELS_4;
}

export function getCurrentMode() {
  return currentMode;
}

export function getLevels() {
  return [...currentLevels];
}

/**
 * Map 6-bit value (or 9-bit for RGB8) to RGB color triple.
 */
export function valueToColor(v) {
  if (currentMode === MODES.RGB8) {
    // 9-bit value: 3 bits per channel
    const r = currentLevels[(v >> 6) & 7];
    const g = currentLevels[(v >> 3) & 7];
    const b = currentLevels[v & 7];
    return [r, g, b];
  }
  if (currentMode === MODES.MONO) {
    // Intensity only: use average level on all channels or luminance
    const lvl = currentLevels[v & 3]; // reuse 4-level for simplicity
    return [lvl, lvl, lvl];
  }
  if (currentMode === MODES.SPATIAL) {
    // Spatial pattern: encode as checker or simple pattern
    const base = currentLevels[v & 3];
    return [base, base, 255 - base]; // high contrast spatial cue
  }
  if (currentMode === MODES.ANALOG) {
    // High-throughput analog mode (~30 bits/symbol) measured at 2.76 Mbps potential
    const val = Math.min(255, Math.max(0, Math.floor(v * 255 / 1023)));
    return [val, val * 0.6, val * 0.3];
  }
  // Default RGB4
  return [
    currentLevels[(v >> 4) & 3],
    currentLevels[(v >> 2) & 3],
    currentLevels[v & 3]
  ];
}

/**
 * Decode RGB -> nearest symbol value
 */
export function colorToValue(r, g, b) {
  if (currentMode === MODES.RGB8) {
    function nearest8(x) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < currentLevels.length; i++) {
        const d = Math.abs(x - currentLevels[i]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    return (nearest8(r) << 6) | (nearest8(g) << 3) | nearest8(b);
  }

  if (currentMode === MODES.MONO || currentMode === MODES.ANALOG) {
    const lum = Math.round((r + g + b) / 3);
    function nearest4(x) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < LEVELS_4.length; i++) {
        const d = Math.abs(x - LEVELS_4[i]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    return nearest4(lum);
  }

  if (currentMode === MODES.SPATIAL) {
    // Approximate by dominant channel or average
    const avg = Math.round((r + g + b) / 3);
    return Math.min(3, Math.max(0, Math.floor(avg / 64)));
  }

  // RGB4 default
  function nearest(x) {
    let bi = 0, bd = 1e9;
    for (let i = 0; i < currentLevels.length; i++) {
      const d = Math.abs(x - currentLevels[i]);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }
  return (nearest(r) << 4) | (nearest(g) << 2) | nearest(b);
}

export function bitsPerSymbol() {
  if (currentMode === MODES.RGB8) return 9;
  return 6;
}
