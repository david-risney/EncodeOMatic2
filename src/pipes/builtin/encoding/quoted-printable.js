/**
 * Quoted-Printable encode/decode pipes.
 */

import { Pipe, PipeError } from '../../pipe.js';

const HEX = '0123456789ABCDEF';
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const UTF8_ENCODER = new TextEncoder();

function isHexDigit(char) {
  return /[0-9A-Fa-f]/u.test(char);
}

function encodeQuotedPrintable(data) {
  let output = '';
  let lineLength = 0;

  const appendToken = (token) => {
    if (lineLength > 0 && lineLength + token.length > 75) {
      output += '=\r\n';
      lineLength = 0;
    }
    output += token;
    lineLength += token.length;
  };

  for (const byte of data) {
    const isPrintableAscii = (byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126);
    const isWhitespace = byte === 0x20 || byte === 0x09;
    if (isPrintableAscii || isWhitespace) {
      appendToken(String.fromCharCode(byte));
      continue;
    }

    appendToken(`=${HEX[(byte >> 4) & 0x0f]}${HEX[byte & 0x0f]}`);
  }

  return output;
}

function decodeQuotedPrintable(text) {
  const bytes = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== '=') {
      bytes.push(char.charCodeAt(0));
      continue;
    }

    if (text[i + 1] === '\r' && text[i + 2] === '\n') {
      i += 2;
      continue;
    }
    if (text[i + 1] === '\n') {
      i += 1;
      continue;
    }

    const a = text[i + 1];
    const b = text[i + 2];
    if (!isHexDigit(a ?? '') || !isHexDigit(b ?? '')) {
      throw new PipeError(`Invalid Quoted-Printable: invalid escape at position ${i}`);
    }

    bytes.push(parseInt(`${a}${b}`, 16));
    i += 2;
  }

  return Uint8Array.from(bytes);
}

export class QuotedPrintableEncodePipe extends Pipe {
  static typeName = 'QuotedPrintableEncode';
  static typeDescription = 'Quoted-Printable Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes using MIME Quoted-Printable.';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    return new Map([['output', UTF8_ENCODER.encode(encodeQuotedPrintable(data))]]);
  }
}

export class QuotedPrintableDecodePipe extends Pipe {
  static typeName = 'QuotedPrintableDecode';
  static typeDescription = 'Quoted-Printable Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode MIME Quoted-Printable data to bytes.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;

    let text;
    try {
      text = UTF8_DECODER.decode(input);
    } catch {
      return -10;
    }

    if (text.length === 0) return 0;

    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '=') continue;
      if (text[i + 1] === '\r' && text[i + 2] === '\n') return 8;
      if (text[i + 1] === '\n') return 8;
      if (isHexDigit(text[i + 1] ?? '') && isHexDigit(text[i + 2] ?? '')) return 8;
      return -10;
    }

    return 0;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    let text;
    try {
      text = UTF8_DECODER.decode(data);
    } catch {
      throw new PipeError('Invalid Quoted-Printable input');
    }

    return new Map([['output', decodeQuotedPrintable(text)]]);
  }
}
