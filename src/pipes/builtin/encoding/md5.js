/**
 * MD5 hash pipe.
 *
 * Pure-JS implementation of the MD5 message-digest algorithm (RFC 1321).
 * Uses only Uint8Array and DataView so it works in browsers without Node.js
 * built-ins.
 */

import { Pipe } from '../../pipe.js';

/** Per-round left-rotation counts (RFC 1321 §3.4). */
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/**
 * Precomputed K[i] = floor(abs(sin(i + 1)) * 2^32) (RFC 1321 §3.4).
 * @type {Uint32Array}
 */
const K = (() => {
  const t = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    t[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }
  return t;
})();

/**
 * Compute the MD5 digest of a byte array.
 * @param {Uint8Array} input
 * @returns {Uint8Array} 16-byte digest
 */
function md5(input) {
  const msgLen = input.length;

  // Padded length: next multiple of 64 that leaves room for 0x80 and 8-byte
  // little-endian bit-length field.
  const paddedLen = (Math.floor((msgLen + 8) / 64) + 1) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[msgLen] = 0x80; // Append 1 bit (as 0x80 byte)

  // Append bit length as 64-bit little-endian (two 32-bit halves)
  const view = new DataView(padded.buffer);
  const bitLen = msgLen * 8;
  view.setUint32(paddedLen - 8, bitLen >>> 0, true);
  view.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  // Initial hash state (little-endian magic constants from RFC 1321)
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  // Process each 512-bit (64-byte) chunk
  for (let offset = 0; offset < paddedLen; offset += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(offset + i * 4, true);
    }

    let a = a0, b = b0, c = c0, d = d0;

    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + K[i] + M[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((f << S[i]) | (f >>> (32 - S[i])))) >>> 0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  // Produce 16-byte digest (little-endian word order)
  const result = new Uint8Array(16);
  const rv = new DataView(result.buffer);
  rv.setUint32(0,  a0, true);
  rv.setUint32(4,  b0, true);
  rv.setUint32(8,  c0, true);
  rv.setUint32(12, d0, true);
  return result;
}

export class Md5HashPipe extends Pipe {
  static typeName = 'Md5Hash';
  static typeDescription = 'MD5 Hash';
  static category = 'Encoding';
  static categoryDescription = 'Compute an MD5 digest from input bytes.';

  process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    return new Map([['output', md5(data)]]);
  }
}
