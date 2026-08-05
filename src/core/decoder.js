/**
 * decoder.js
 * Core decoding logic for received symbol grid.
 * Uses homography, modulation, packet, checksum.
 */

import { applyHomography } from './homography.js';
import { colorToValue, bitsPerSymbol } from './modulation.js';
import { HEADER_CELLS, gridGeom, cellCenter, parseHeader, valuesToBytes } from './packet.js';
import { verifyChecksum } from './checksum.js';

export class Decoder {
  constructor(density = 'medium') {
    this.density = density;
    this.geom = gridGeom(density);
    this.H = null; // homography
    this.lastFrameData = null;
  }

  setDensity(density) {
    this.density = density;
    this.geom = gridGeom(density);
  }

  setHomography(H) {
    this.H = H;
  }

  /**
   * Sample symbols from image data using homography.
   * imageData: ImageData or {data, width, height}
   * Returns array of symbol values or null on failure.
   */
  sampleSymbols(imageData, geom = this.geom) {
    if (!this.H) return null;

    const { width: W, height: Hh } = imageData;
    const data = imageData.data || imageData;

    const totalCells = geom.w * geom.h;
    const vals = [];
    let bad = false;

    for (let row = 0; row < geom.h && !bad; row++) {
      for (let col = 0; col < geom.w; col++) {
        const c = cellCenter(geom, col, row);
        const p = applyHomography(this.H, c.x, c.y);
        const px = Math.round(p.x);
        const py = Math.round(p.y);

        if (px < 0 || py < 0 || px >= W || py >= Hh) {
          bad = true;
          break;
        }

        const i = (py * W + px) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const v = colorToValue(r, g, b);
        vals.push(v);
      }
    }

    if (bad || vals.length < HEADER_CELLS) return null;
    return vals;
  }

  /**
   * Decode one frame's symbol values into {frameIdx, bytes, checksumValid, isFinal}
   */
  decodeFrame(symbolVals) {
    if (!symbolVals || symbolVals.length < HEADER_CELLS) return null;

    const { frameIdx, isFinal, checksum } = parseHeader(symbolVals);
    const dataVals = symbolVals.slice(HEADER_CELLS);
    const bytes = valuesToBytes(dataVals);
    const csValid = verifyChecksum(bytes, checksum);

    return {
      frameIdx,
      bytes,
      checksumValid: csValid,
      isFinal,
      rawChecksum: checksum
    };
  }

  /**
   * Full process frame: imageData -> decoded frame info
   */
  processFrame(imageData) {
    const vals = this.sampleSymbols(imageData);
    if (!vals) return null;

    const frameInfo = this.decodeFrame(vals);
    if (!frameInfo) return null;

    this.lastFrameData = { vals, frameInfo };
    return frameInfo;
  }
}
