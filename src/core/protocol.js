/**
 * Self-describing packet protocol v2
 * Each frame is independently meaningful.
 */
export const PROTOCOL_VERSION = 2;

export function buildPacketHeader({ sessionId, seq, flags = 0, payloadLen, ts = Date.now() }) {
  return new Uint8Array([
    PROTOCOL_VERSION,
    sessionId >> 8, sessionId & 0xff,
    (seq >> 24) & 0xff, (seq >> 16) & 0xff, (seq >> 8) & 0xff, seq & 0xff,
    (ts >> 24) & 0xff, (ts >> 16) & 0xff, (ts >> 8) & 0xff, ts & 0xff,
    flags,
    (payloadLen >> 8) & 0xff, payloadLen & 0xff,
    0, 0, 0, 0 // CRC placeholder
  ]);
}
