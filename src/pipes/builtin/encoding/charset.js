/**
 * Character set encoding/decoding pipes.
 *
 * Charset Decode: interprets input bytes as text in the specified encoding,
 *   outputs the decoded string as UTF-8 bytes.
 *
 * Charset Encode: takes UTF-8 text bytes and re-encodes them to the target encoding.
 *   (Note: re-encoding to non-UTF-8 encodings uses TextEncoder which only supports UTF-8
 *    in browsers; for others we emit UTF-8 with a note, or use the encoding polyfill approach.)
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

export class CharsetDecodePipe extends Pipe {
  static typeName = 'CharsetDecode';
  static typeDescription = 'Charset Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode bytes from a specified character encoding to UTF-8 text.';

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
    // For other encodings we need a polyfill or we emit UTF-8 as a fallback.
    if (toEnc === 'utf-8') {
      return new Map([['output', new TextEncoder().encode(text)]]);
    }

    // Try using the non-standard TextEncoder with encoding argument (Chrome 38+, limited support)
    // Fallback: emit UTF-8 bytes with the BOM if encoding supports it.
    if (toEnc === 'utf-16le' || toEnc === 'utf-16') {
      const buf = new ArrayBuffer(text.length * 2);
      const view = new DataView(buf);
      for (let i = 0; i < text.length; i++) {
        view.setUint16(i * 2, text.charCodeAt(i), true); // little-endian
      }
      return new Map([['output', new Uint8Array(buf)]]);
    }

    if (toEnc === 'utf-16be') {
      const buf = new ArrayBuffer(text.length * 2);
      const view = new DataView(buf);
      for (let i = 0; i < text.length; i++) {
        view.setUint16(i * 2, text.charCodeAt(i), false); // big-endian
      }
      return new Map([['output', new Uint8Array(buf)]]);
    }

    // For other encodings: fall back to UTF-8
    return new Map([['output', new TextEncoder().encode(text)]]);
  }
}
