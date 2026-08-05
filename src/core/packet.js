/**
 * packet.js
 * Packet / frame construction and parsing logic.
 * Header: 4 cells = [idxLow(6b), idxHigh(6b), flags(6b), checksum(6b)]
 * Payload: variable 6-bit symbols packed into bytes.
 */

import { bitsPerSymbol } from './modulation.js';
import { checksumOf } from './checksum.js';

export const HEADER_CELLS = 4;

export function gridGeom(density, canvasW = 800, canvasH = 600, margin = 60) {
  const DENSITIES = {
    small: { w: 16, h: 12 },
    medium: { w: 24, h: 18 },
    large: { w: 32, h: 24 },
    xlarge: { w: 48, h: 36 },
    xxlarge: { w: 64, h: 48 }
  };
  const { w, h } = DENSITIES[density] || DENSITIES.medium;
  const gw = canvasW - 2 * margin;
  const gh = canvasH - 2 * margin;
  const cellW = gw / w;
  const cellH = gh / h;
  return { w, h, cellW, cellH, density };
}

export function cellCenter(geom, col, row) {
  return {
    x: geom.marginX || 60 + geom.cellW * (col + 0.5),
    y: geom.marginY || 60 + geom.cellH * (row + 0.5)
  };
}

export function bytesToFrames(fullBytes, density) {
  const geom = gridGeom(density);
  const totalCells = geom.w * geom.h;
  const payloadCells = totalCells - HEADER_CELLS;
  const bps = bitsPerSymbol();
  const bytesPerFrame = Math.floor(payloadCells * bps / 8);

  const frames = [];
  for (let i = 0; i < fullBytes.length; i += bytesPerFrame) {
    let chunk = fullBytes.slice(i, i + bytesPerFrame);
    if (chunk.length < bytesPerFrame) {
      const padded = new Uint8Array(bytesPerFrame);
      padded.set(chunk);
      chunk = padded;
    }
    frames.push(chunk);
  }
  if (frames.length === 0) {
    frames.push(new Uint8Array(bytesPerFrame));
  }
  return { frames, bytesPerFrame, payloadCells };
}

export function frameToValues(chunkBytes, payloadCells) {
  let bitStr = '';
  for (const b of chunkBytes) {
    bitStr += b.toString(2).padStart(8, '0');
  }
  const bps = bitsPerSymbol();
  const neededBits = payloadCells * bps;
  while (bitStr.length < neededBits) bitStr += '0';

  const values = [];
  for (let i = 0; i < neededBits; i += bps) {
    values.push(parseInt(bitStr.substr(i, bps), 2));
  }
  return values;
}

export function valuesToBytes(values) {
  const bps = bitsPerSymbol();
  let bitStr = '';
  for (const v of values) {
    bitStr += v.toString(2).padStart(bps, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bitStr.length; i += 8) {
    bytes.push(parseInt(bitStr.substr(i, 8), 2));
  }
  return new Uint8Array(bytes);
}

export function buildFramePayload(frameIdx, totalFrames, chunkBytes, payloadCells) {
  const isLast = (frameIdx === totalFrames - 1) ? 63 : 0;
  const checksum = checksumOf(chunkBytes);
  const idxLow = frameIdx & 0x3f;
  const idxHigh = (frameIdx >> 6) & 0x3f;
  const headerVals = [idxLow, idxHigh, isLast, checksum];
  const dataVals = frameToValues(chunkBytes, payloadCells);
  return headerVals.concat(dataVals);
}

export function parseHeader(vals) {
  const idxLow = vals[0] || 0;
  const idxHigh = vals[1] || 0;
  const flags = vals[2] || 0;
  const checksum = vals[3] || 0;
  const frameIdx = idxLow | (idxHigh << 6);
  const isFinal = flags === 63;
  return { frameIdx, isFinal, checksum };
}
