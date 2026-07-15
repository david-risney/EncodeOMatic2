/**
 * Character set encoding/decoding pipes.
 *
 * Charset Decode: interprets input bytes as text in the specified encoding,
 *   outputs the decoded string as UTF-8 bytes.
 *
 * Charset Encode: takes UTF-8 text bytes and re-encodes them to the target encoding.
 *   UTF-16 variants are manually encoded to properly handle surrogate pairs.
 *   Other non-UTF-8 encodings fall back to UTF-8 output.
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
      const decoder = new TextDecoder(fromEnc, { fatal });
      text = decoder.decode(data);
    } catch (e) {
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
    // For other encodings we provide manual encoding with proper surrogate pair handling.
    if (toEnc === 'utf-8') {
      return new Map([['output', new TextEncoder().encode(text)]]);
    }

    if (toEnc === 'utf-16le' || toEnc === 'utf-16') {
      return new Map([['output', encodeUtf16(text, true)]]);
    }

    if (toEnc === 'utf-16be') {
      return new Map([['output', encodeUtf16(text, false)]]);
    }

    // For other encodings: fall back to UTF-8
    return new Map([['output', new TextEncoder().encode(text)]]);
  }
}
