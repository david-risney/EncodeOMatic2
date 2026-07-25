/**
 * CRC-32 and Adler-32 checksum pipes.
 *
 * Pure-JS implementations — no external dependencies, works in browsers.
 *
 * Both pipes output a 4-byte big-endian representation of the checksum so the
 * result can be piped through Hex Encode to get the familiar hex string.
 */

import { Pipe } from '../../pipe.js';

// ---------------------------------------------------------------------------
// CRC-32 (IEEE 802.3 / ISO 3309 polynomial 0xEDB88320 — reflected form)
// ---------------------------------------------------------------------------

/**
 * Lookup table for the standard CRC-32 polynomial.
 * @type {Uint32Array}
 */
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

/**
 * Compute the CRC-32 checksum of a byte array.
 * @param {Uint8Array} data
 * @returns {number} Unsigned 32-bit checksum
 */
function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Adler-32 (RFC 1950 §8.2)
// ---------------------------------------------------------------------------

const ADLER_MOD = 65521;

/**
 * Compute the Adler-32 checksum of a byte array.
 * @param {Uint8Array} data
 * @returns {number} Unsigned 32-bit checksum
 */
function adler32(data) {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % ADLER_MOD;
    b = (b + a) % ADLER_MOD;
  }
  return ((b << 16) | a) >>> 0;
}

// ---------------------------------------------------------------------------
// Pipe classes
// ---------------------------------------------------------------------------

/**
 * Convert a 32-bit unsigned integer to a 4-byte big-endian Uint8Array.
 * @param {number} value
 * @returns {Uint8Array}
 */
function uint32ToBytes(value) {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint32(0, value, false); // big-endian
  return buf;
}

export class Crc32Pipe extends Pipe {
  static typeName = 'Crc32';
  static typeDescription = 'CRC-32';
  static category = 'Encoding';
  static categoryDescription = 'Compute a CRC-32 checksum from input bytes.';

  process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    return new Map([['output', uint32ToBytes(crc32(data))]]);
  }
}

export class Adler32Pipe extends Pipe {
  static typeName = 'Adler32';
  static typeDescription = 'Adler-32';
  static category = 'Encoding';
  static categoryDescription = 'Compute an Adler-32 checksum from input bytes.';

  process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    return new Map([['output', uint32ToBytes(adler32(data))]]);
  }
}
