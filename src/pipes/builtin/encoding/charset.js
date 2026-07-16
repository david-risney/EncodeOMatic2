/**
 * Character set encoding/decoding pipes.
 *
 * Charset Decode: interprets input bytes as text in the specified encoding,
 *   outputs the decoded string as UTF-8 bytes.
 *   UTF-32 variants are manually decoded since TextDecoder does not support
 *   them in all browser environments.
 *
 * Charset Encode: takes UTF-8 text bytes and re-encodes them to the target encoding.
 *   Supported targets: utf-8, utf-16le, utf-16, utf-16be, utf-32le, utf-32be,
 *   ascii, iso-8859-1.  All other encodings throw a PipeError.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';

const COMMON_ENCODINGS = [
  'utf-8',
  'utf-16be',
  'utf-16le',
  'utf-16',
  'utf-32be',
  'utf-32le',
  'iso-8859-1',
  'iso-8859-2',
  'iso-8859-15',
  'windows-1250',
  'windows-1251',
  'windows-1252',
  'windows-1253',
  'shift_jis',
  'euc-jp',
  'iso-2022-jp',
  'gbk',
  'big5',
  'ascii',
  'koi8-r',
];

/**
 * Decode UTF-32 bytes to a JS string.
 * @param {Uint8Array} bytes
 * @param {boolean} littleEndian
 * @param {boolean} fatal  throw on invalid code points when true, emit U+FFFD when false
 * @returns {string}
 */
function decodeUtf32(bytes, littleEndian, fatal) {
  if (bytes.length % 4 !== 0) {
    throw new PipeError(
      `UTF-32 input length must be a multiple of 4 bytes, got ${bytes.length}`
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let result = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const cp = view.getUint32(i, littleEndian);
    if (cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) {
      if (fatal) {
        throw new PipeError(
          `Invalid Unicode code point 0x${cp.toString(16).toUpperCase().padStart(8, '0')} in UTF-32 input`
        );
      }
      result += '\uFFFD';
    } else {
      result += String.fromCodePoint(cp);
    }
  }
  return result;
}

/**
 * Encode a JS string to UTF-16 bytes, correctly handling characters outside
 * the Basic Multilingual Plane (code points > U+FFFF) by using codePointAt()
 * and properly outputting surrogate pairs.
 * @param {string} text
 * @param {boolean} littleEndian
 * @returns {Uint8Array}
 */
function encodeUtf16(text, littleEndian) {
  // Count UTF-16 code units (surrogate pairs count as 2)
  const units = [];
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i);
    if (cp > 0xFFFF) {
      // Characters above U+FFFF are stored as surrogate pairs in JS strings
      // (2 code units), so we advance i by 2 to skip both code units.
      const hi = 0xD800 + ((cp - 0x10000) >> 10);
      const lo = 0xDC00 + ((cp - 0x10000) & 0x3FF);
      units.push(hi, lo);
      i += 2; // advance past the two JS code units for this code point
    } else {
      units.push(cp);
      i += 1;
    }
  }
  const buf = new ArrayBuffer(units.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < units.length; i++) {
    view.setUint16(i * 2, units[i], littleEndian);
  }
  return new Uint8Array(buf);
}

/**
 * Encode a JS string to UTF-32 bytes.  Each Unicode code point becomes
 * exactly 4 bytes.
 * @param {string} text
 * @param {boolean} littleEndian
 * @returns {Uint8Array}
 */
function encodeUtf32(text, littleEndian) {
  // Array.from iterates over Unicode code points, correctly splitting
  // surrogate pairs that JS strings store as two UTF-16 code units.
  const codePoints = Array.from(text, ch => ch.codePointAt(0));
  const buf = new ArrayBuffer(codePoints.length * 4);
  const view = new DataView(buf);
  for (let i = 0; i < codePoints.length; i++) {
    view.setUint32(i * 4, codePoints[i], littleEndian);
  }
  return new Uint8Array(buf);
}

/**
 * Encode a JS string to ASCII bytes (U+0000–U+007F only).
 * @param {string} text
 * @returns {Uint8Array}
 */
function encodeAscii(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp > 0x7F) {
      throw new PipeError(
        `Character '${ch}' (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) cannot be encoded as ASCII`
      );
    }
    bytes.push(cp);
  }
  return new Uint8Array(bytes);
}

/**
 * Encode a JS string to ISO-8859-1 bytes (U+0000–U+00FF only).
 * @param {string} text
 * @returns {Uint8Array}
 */
function encodeIso8859_1(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp > 0xFF) {
      throw new PipeError(
        `Character '${ch}' (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) cannot be encoded as ISO-8859-1`
      );
    }
    bytes.push(cp);
  }
  return new Uint8Array(bytes);
}

export class CharsetDecodePipe extends Pipe {
  static typeName = 'CharsetDecode';
  static typeDescription = 'Charset Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode bytes from a specified character encoding to UTF-8 text.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    const hasBom =
      (input.length >= 3 && input[0] === 0xEF && input[1] === 0xBB && input[2] === 0xBF) ||
      (input.length >= 4 && input[0] === 0x00 && input[1] === 0x00 &&
        input[2] === 0xFE && input[3] === 0xFF) ||
      (input.length >= 4 && input[0] === 0xFF && input[1] === 0xFE &&
        input[2] === 0x00 && input[3] === 0x00) ||
      (input.length >= 2 && input[0] === 0xFE && input[1] === 0xFF) ||
      (input.length >= 2 && input[0] === 0xFF && input[1] === 0xFE);
    return hasBom ? 10 : 0;
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'fromEncoding',
        description: 'Source character encoding of the input bytes',
        defaultValue: 'utf-8',
        type: 'select',
        options: COMMON_ENCODINGS,
      }),
      new PipeConfig({
        name: 'fatal',
        description: 'Throw an error on invalid byte sequences',
        defaultValue: true,
        type: 'boolean',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const fromEnc = this.getConfig('fromEncoding')?.value ?? 'utf-8';
    const fatal = this.getConfig('fatal')?.value ?? true;

    let text;
    try {
      if (fromEnc === 'utf-32le' || fromEnc === 'utf-32be') {
        text = decodeUtf32(data, fromEnc === 'utf-32le', fatal);
      } else {
        const decoder = new TextDecoder(fromEnc, { fatal });
        text = decoder.decode(data);
      }
    } catch (e) {
      if (e instanceof PipeError) throw e;
      throw new PipeError(`Cannot decode bytes as ${fromEnc}: ${e.message}`);
    }

    return new Map([['output', new TextEncoder().encode(text)]]);
  }
}

export class CharsetEncodePipe extends Pipe {
  static typeName = 'CharsetEncode';
  static typeDescription = 'Charset Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode UTF-8 text bytes to a target character encoding.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(input);
      return 0;
    } catch {
      return -10;
    }
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'toEncoding',
        description: 'Target character encoding for the output bytes',
        defaultValue: 'utf-8',
        type: 'select',
        options: COMMON_ENCODINGS,
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const toEnc = this.getConfig('toEncoding')?.value ?? 'utf-8';

    // Decode input as UTF-8 first
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch (e) {
      throw new PipeError(`Input bytes are not valid UTF-8: ${e.message}`);
    }

    // Browsers only natively support UTF-8 encoding via TextEncoder.
    // All other encodings are implemented manually below.
    if (toEnc === 'utf-8') {
      return new Map([['output', new TextEncoder().encode(text)]]);
    }

    if (toEnc === 'utf-16le' || toEnc === 'utf-16') {
      return new Map([['output', encodeUtf16(text, true)]]);
    }

    if (toEnc === 'utf-16be') {
      return new Map([['output', encodeUtf16(text, false)]]);
    }

    if (toEnc === 'utf-32le') {
      return new Map([['output', encodeUtf32(text, true)]]);
    }

    if (toEnc === 'utf-32be') {
      return new Map([['output', encodeUtf32(text, false)]]);
    }

    if (toEnc === 'ascii') {
      return new Map([['output', encodeAscii(text)]]);
    }

    if (toEnc === 'iso-8859-1') {
      return new Map([['output', encodeIso8859_1(text)]]);
    }

    throw new PipeError(`Encoding to '${toEnc}' is not supported`);
  }
}
