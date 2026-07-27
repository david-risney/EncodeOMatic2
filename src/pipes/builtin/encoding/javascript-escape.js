/**
 * JavaScript escape encode/decode pipes.
 */

import { Pipe, PipeError } from '../../pipe.js';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const UTF8_ENCODER = new TextEncoder();

const SIMPLE_UNESCAPE_MAP = {
  '0': '\0',
  b: '\b',
  t: '\t',
  n: '\n',
  v: '\v',
  f: '\f',
  r: '\r',
  '\\': '\\',
  '"': '"',
  "'": '\'',
};

function toCodePointEscape(codePoint) {
  if (codePoint <= 0xffff) {
    return `\\u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return `\\u{${codePoint.toString(16).toUpperCase()}}`;
}

function encodeJavaScriptEscapes(text) {
  let result = '';
  for (const char of text) {
    result += toCodePointEscape(char.codePointAt(0));
  }
  return result;
}

function decodeJavaScriptEscapes(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') {
      result += text[i];
      continue;
    }

    const next = text[i + 1];
    if (next === undefined) {
      throw new PipeError(`Invalid JavaScript escape at position ${i}`);
    }

    if (SIMPLE_UNESCAPE_MAP[next] !== undefined) {
      result += SIMPLE_UNESCAPE_MAP[next];
      i += 1;
      continue;
    }

    if (next === 'x') {
      const hex = text.slice(i + 2, i + 4);
      if (!/^[0-9A-Fa-f]{2}$/u.test(hex)) {
        throw new PipeError(`Invalid JavaScript escape at position ${i}`);
      }
      result += String.fromCharCode(Number.parseInt(hex, 16));
      i += 3;
      continue;
    }

    if (next !== 'u') {
      throw new PipeError(`Invalid JavaScript escape at position ${i}`);
    }

    if (text[i + 2] === '{') {
      const end = text.indexOf('}', i + 3);
      if (end === -1) {
        throw new PipeError(`Invalid JavaScript escape at position ${i}`);
      }
      const hex = text.slice(i + 3, end);
      if (!/^[0-9A-Fa-f]{1,6}$/u.test(hex)) {
        throw new PipeError(`Invalid JavaScript escape at position ${i}`);
      }
      const codePoint = Number.parseInt(hex, 16);
      if (codePoint > 0x10ffff) {
        throw new PipeError(`Invalid JavaScript escape at position ${i}`);
      }
      result += String.fromCodePoint(codePoint);
      i = end;
      continue;
    }

    const hex = text.slice(i + 2, i + 6);
    if (!/^[0-9A-Fa-f]{4}$/u.test(hex)) {
      throw new PipeError(`Invalid JavaScript escape at position ${i}`);
    }
    result += String.fromCharCode(Number.parseInt(hex, 16));
    i += 5;
  }
  return result;
}

function isLikelyJavaScriptEscapedText(text) {
  if (!text.includes('\\')) return false;
  return /\\(?:[0btnvfr\\'"u]|x[0-9A-Fa-f]{2}|u\{[0-9A-Fa-f]{1,6}\}|u[0-9A-Fa-f]{4})/u.test(text);
}

export class JavaScriptEscapeEncodePipe extends Pipe {
  static typeName = 'JavaScriptEscapeEncode';
  static typeDescription = 'JavaScript Escape Encode';
  static category = 'Escaping';
  static categoryDescription = 'Encode text as JavaScript \\uXXXX and \\u{...} escape sequences.';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);

    let text;
    try {
      text = UTF8_DECODER.decode(data);
    } catch {
      throw new PipeError('Input is not valid UTF-8');
    }

    return new Map([['output', UTF8_ENCODER.encode(encodeJavaScriptEscapes(text))]]);
  }
}

export class JavaScriptEscapeDecodePipe extends Pipe {
  static typeName = 'JavaScriptEscapeDecode';
  static typeDescription = 'JavaScript Escape Decode';
  static category = 'Escaping';
  static categoryDescription = 'Decode JavaScript escape sequences to UTF-8 text.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;

    let text;
    try {
      text = UTF8_DECODER.decode(input);
    } catch {
      return -10;
    }

    if (isLikelyJavaScriptEscapedText(text)) return 8;
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

    return new Map([['output', UTF8_ENCODER.encode(decodeJavaScriptEscapes(text))]]);
  }
}

export const builtinPipes = [JavaScriptEscapeEncodePipe, JavaScriptEscapeDecodePipe];
