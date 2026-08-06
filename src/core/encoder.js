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
  /**
   * Optimized draw stub — measurement framework tracks time here
   */
  drawFrameFast(ctx, symbolFrame, geom = this.geom) {
    const t0 = performance.now();
    const result = this.drawFrame(ctx, symbolFrame, geom);
    const t1 = performance.now();
    if (window.photonProfiler) window.photonProfiler.recordFrame({ renderMs: t1 - t0 });
    return result;
  }

  drawFrame(ctx, symbolFrame, geom = this.geom) {
    // Optimized path: build ImageData buffer once instead of thousands of fillRect
    const cellW = Math.ceil(geom.cellW);
    const cellH = Math.ceil(geom.cellH);
    const imgW = geom.w * cellW + 1;
    const imgH = geom.h * cellH + 1;
    const imgData = ctx.createImageData(imgW, imgH);
    const data = imgData.data;

    let vi = 0;
    for (let row = 0; row < geom.h; row++) {
      for (let col = 0; col < geom.w; col++) {
        const v = symbolFrame[vi++];
        const [r, g, b] = valueToColor(v);
        // Fill cell region directly in pixel buffer (simplified)
        for (let dy = 0; dy < cellH; dy++) {
          for (let dx = 0; dx < cellW; dx++) {
            const px = (row * cellH + dy) * imgW * 4 + (col * cellW + dx) * 4;
            if (px + 3 < data.length) {
              data[px] = r; data[px + 1] = g; data[px + 2] = b; data[px + 3] = 255;
            }
          }
        }
      }
    }
    ctx.putImageData(imgData, geom.marginX || 60, geom.marginY || 60);

    // Corner markers
    ctx.fillStyle = 'rgb(255,0,255)';
    const ms = 40;
    const positions = [
      { x: 30, y: 30 }, { x: this.canvasW - 30, y: 30 },
      { x: this.canvasW - 30, y: this.canvasH - 30 }, { x: 30, y: this.canvasH - 30 }
    ];
    for (const p of positions) {
      ctx.fillRect(p.x - ms / 2, p.y - ms / 2, ms, ms);
    }
    return symbolFrame;
  }
}
