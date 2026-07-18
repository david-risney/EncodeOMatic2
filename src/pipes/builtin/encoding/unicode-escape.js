/**
 * Unicode escape encode/decode pipes.
 */

import { Pipe, PipeError } from '../../pipe.js';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const UTF8_ENCODER = new TextEncoder();

function toCodePointEscape(codePoint) {
  if (codePoint <= 0xffff) {
    return `\\u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return `\\u{${codePoint.toString(16).toUpperCase()}}`;
}

function encodeUnicodeEscapes(text) {
  let result = '';
  for (const char of text) {
    result += toCodePointEscape(char.codePointAt(0));
  }
  return result;
}

function decodeUnicodeEscapes(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\' || text[i + 1] !== 'u') {
      result += text[i];
      continue;
    }

    if (text[i + 2] === '{') {
      const end = text.indexOf('}', i + 3);
      if (end === -1) {
        throw new PipeError(`Invalid Unicode escape at position ${i}`);
      }
      const hex = text.slice(i + 3, end);
      if (!/^[0-9A-Fa-f]{1,6}$/u.test(hex)) {
        throw new PipeError(`Invalid Unicode escape at position ${i}`);
      }
      const codePoint = Number.parseInt(hex, 16);
      if (codePoint > 0x10ffff) {
        throw new PipeError(`Invalid Unicode escape at position ${i}`);
      }
      result += String.fromCodePoint(codePoint);
      i = end;
      continue;
    }

    const hex = text.slice(i + 2, i + 6);
    if (!/^[0-9A-Fa-f]{4}$/u.test(hex)) {
      throw new PipeError(`Invalid Unicode escape at position ${i}`);
    }
    result += String.fromCharCode(Number.parseInt(hex, 16));
    i += 5;
  }
  return result;
}

export class UnicodeEscapeEncodePipe extends Pipe {
  static typeName = 'UnicodeEscapeEncode';
  static typeDescription = 'Unicode Escape Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode text as \\uXXXX and \\u{...} escape sequences.';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);

    let text;
    try {
      text = UTF8_DECODER.decode(data);
    } catch {
      throw new PipeError('Input is not valid UTF-8');
    }

    return new Map([['output', UTF8_ENCODER.encode(encodeUnicodeEscapes(text))]]);
  }
}

export class UnicodeEscapeDecodePipe extends Pipe {
  static typeName = 'UnicodeEscapeDecode';
  static typeDescription = 'Unicode Escape Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode \\uXXXX and \\u{...} escape sequences to UTF-8 text.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;

    let text;
    try {
      text = UTF8_DECODER.decode(input);
    } catch {
      return -10;
    }

    if (text.includes('\\u{') || /\\u[0-9A-Fa-f]{4}/u.test(text)) return 8;
    return 0;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);

    let text;
    try {
      text = UTF8_DECODER.decode(data);
    } catch {
      throw new PipeError('Input is not valid UTF-8');
    }

    return new Map([['output', UTF8_ENCODER.encode(decodeUnicodeEscapes(text))]]);
  }
}
