/**
 * Character set encoding/decoding pipes.
 *
 * Charset Decode: interprets input bytes as text in the specified encoding,
 *   outputs the decoded string as UTF-8 bytes.
 *   Uses TextDecoder for WHATWG-supported encodings (preserves the fatal flag),
 *   and iconv-lite for utf-32be/utf-32le which are not in the WHATWG Encoding
 *   spec.
 *
 * Charset Encode: takes UTF-8 text bytes and re-encodes them to any of the
 *   supported target encodings using iconv-lite.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';
import iconv from '../../../../vendor/iconv-lite.js';

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

// Encodings that TextDecoder supports (and therefore honour the fatal flag).
// This is everything in COMMON_ENCODINGS except utf-32be and utf-32le, which
// are not in the WHATWG Encoding spec.  If COMMON_ENCODINGS grows, keep this
// filter in sync so new non-WHATWG encodings fall through to iconv-lite.
const WHATWG_ENCODINGS = new Set(COMMON_ENCODINGS.filter(
  enc => enc !== 'utf-32be' && enc !== 'utf-32le'
));

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
      if (WHATWG_ENCODINGS.has(fromEnc)) {
        // TextDecoder supports these encodings and honours the fatal flag.
        const decoder = new TextDecoder(fromEnc, { fatal });
        text = decoder.decode(data);
      } else {
        // utf-32be / utf-32le — not in the WHATWG Encoding spec; use iconv-lite.
        text = iconv.decode(data, fromEnc);
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

    // Decode input as UTF-8 first.
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch (e) {
      throw new PipeError(`Input bytes are not valid UTF-8: ${e.message}`);
    }

    if (!iconv.encodingExists(toEnc)) {
      throw new PipeError(`Encoding to '${toEnc}' is not supported`);
    }

    try {
      return new Map([['output', new Uint8Array(iconv.encode(text, toEnc))]]);
    } catch (e) {
      throw new PipeError(`Cannot encode text as ${toEnc}: ${e.message}`);
    }
  }
}
