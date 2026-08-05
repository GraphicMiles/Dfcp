/**
 * checksum.js
 * Simple 6-bit checksum for frame integrity.
 * Portable.
 */

export function checksumOf(bytes) {
  let s = 0;
  for (const b of bytes) {
    s = (s + b) & 0x3f;
  }
  return s;
}

export function verifyChecksum(bytes, expected) {
  return checksumOf(bytes) === expected;
}
