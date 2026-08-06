/**
 * Packet / frame construction v2 — self-describing frames.
 */
import { bitsPerSymbol } from './modulation.js';
import { checksumOf } from './checksum.js';
import { buildPacketHeader, PROTOCOL_VERSION } from './protocol.js';

export const HEADER_BYTES = 16;

export function gridGeom(density, canvasW = 800, canvasH = 600, margin = 60) {
  const DENSITIES = { small:{w:16,h:12}, medium:{w:24,h:18}, large:{w:32,h:24}, xlarge:{w:48,h:36}, xxlarge:{w:64,h:48} };
  const {w,h} = DENSITIES[density] || DENSITIES.medium;
  return { w, h, cellW: (canvasW-2*margin)/w, cellH: (canvasH-2*margin)/h, density, marginX: margin, marginY: margin };
}

export function bytesToFrames(fullBytes, density) {
  const geom = gridGeom(density);
  const payloadCells = geom.w * geom.h - 4;
  const bps = bitsPerSymbol();
  const bytesPerFrame = Math.floor(payloadCells * bps / 8);
  const frames = [];
  for (let i=0; i<fullBytes.length; i+=bytesPerFrame) {
    let chunk = fullBytes.slice(i, i+bytesPerFrame);
    if (chunk.length < bytesPerFrame) { const p=new Uint8Array(bytesPerFrame); p.set(chunk); chunk=p; }
    frames.push(chunk);
  }
  if (!frames.length) frames.push(new Uint8Array(bytesPerFrame));
  return { frames, bytesPerFrame, payloadCells, geom };
}

export function buildFramePayload({ sessionId=1, seq=0, flags=0, chunkBytes, payloadCells, ts=Date.now() }) {
  const payloadLen = chunkBytes.length;
  const header = buildPacketHeader({ sessionId, seq, flags, payloadLen, ts });
  // Embed payload directly (simplified wire format for optical channel)
  const out = new Uint8Array(header.length + payloadLen + 4);
  out.set(header, 0);
  out.set(chunkBytes, header.length);
  // CRC32 placeholder — replace with real checksum
  const crc = checksumOf(chunkBytes);
  out[header.length + payloadLen] = (crc >> 24) & 0xff;
  out[header.length + payloadLen + 1] = (crc >> 16) & 0xff;
  out[header.length + payloadLen + 2] = (crc >> 8) & 0xff;
  out[header.length + payloadLen + 3] = crc & 0xff;
  return out;
}
