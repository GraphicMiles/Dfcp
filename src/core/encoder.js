/**
 * encoder.js
 * High-level TX encoder: message -> frames -> symbol grids
 * Uses packet and modulation modules.
 */

import { gridGeom, bytesToFrames, buildFramePayload } from './packet.js';
import { valueToColor, setModulationMode, getCurrentMode } from './modulation.js';

export class Encoder {
  constructor(density = 'medium', canvasW = 800, canvasH = 600) {
    this.density = density;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.margin = 60;
    this.geom = gridGeom(density, canvasW, canvasH, this.margin);
    this.mode = getCurrentMode();
  }

  setDensity(density) {
    this.density = density;
    this.geom = gridGeom(density, this.canvasW, this.canvasH, this.margin);
  }

  setModulation(mode) {
    setModulationMode(mode);
    this.mode = mode;
  }

  /**
   * Encode full message into sequence of frames (each frame is array of symbol values)
   */
  encodeMessage(text) {
    const msgBytes = new TextEncoder().encode(text || '');
    const lenBytes = new Uint8Array(4);
    new DataView(lenBytes.buffer).setUint32(0, msgBytes.length, false);

    const fullBytes = new Uint8Array(lenBytes.length + msgBytes.length);
    fullBytes.set(lenBytes, 0);
    fullBytes.set(msgBytes, 4);

    const { frames: byteFrames, bytesPerFrame, payloadCells } = bytesToFrames(fullBytes, this.density);
    const totalFrames = byteFrames.length;

    const symbolFrames = byteFrames.map((chunk, idx) => {
      return buildFramePayload(idx, totalFrames, chunk, payloadCells);
    });

    return {
      frames: symbolFrames,
      bytesPerFrame,
      payloadCells,
      totalFrames,
      geom: this.geom,
      density: this.density,
      mode: this.mode
    };
  }

  /**
   * Draw a single frame onto a canvas context (for TX)
   * Returns symbol values used.
   */
  drawFrame(ctx, symbolFrame, geom = this.geom) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    let vi = 0;
    for (let row = 0; row < geom.h; row++) {
      for (let col = 0; col < geom.w; col++) {
        const v = symbolFrame[vi++];
        const [r, g, b] = valueToColor(v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(
          this.margin + col * geom.cellW,
          this.margin + row * geom.cellH,
          Math.ceil(geom.cellW) + 1,
          Math.ceil(geom.cellH) + 1
        );
      }
    }

    // Corner markers (magenta) - always present for calibration
    ctx.fillStyle = 'rgb(255,0,255)';
    const ms = 40;
    const positions = [
      { x: 30, y: 30 },                    // TL
      { x: this.canvasW - 30, y: 30 },     // TR
      { x: this.canvasW - 30, y: this.canvasH - 30 }, // BR
      { x: 30, y: this.canvasH - 30 }      // BL
    ];
    for (const p of positions) {
      ctx.fillRect(p.x - ms / 2, p.y - ms / 2, ms, ms);
    }

    return symbolFrame;
  }
}
