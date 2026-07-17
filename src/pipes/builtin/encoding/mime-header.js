/**
 * MIME header decoding pipe (RFC 2047 encoded words).
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeError } from '../../pipe.js';

const MIME_HEADER_PATTERN = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
const MIME_HEADER_INPUT_PATTERN = /=\?[^?]+\?[BbQq]\?[^?]*\?=/;

function decodeBase64Bytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeQHeader(text) {
  const result = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '_') {
      result.push(0x20);
      i++;
    } else if (text[i] === '=') {
      if (i + 2 >= text.length) throw new Error('Incomplete Q-encoded byte');
      const hex = text.slice(i + 1, i + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error('Invalid Q-encoded byte');
      result.push(parseInt(hex, 16));
      i += 3;
    } else {
      result.push(text.charCodeAt(i));
      i++;
    }
  }
  return new Uint8Array(result);
}

export class MimeHeaderDecodePipe extends StringPipe {
  static typeName = 'MimeHeaderDecode';
  static typeDescription = 'MIME Header Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode RFC 2047 encoded words in email headers.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }
    return MIME_HEADER_INPUT_PATTERN.test(text) ? 10 : 0;
  }

  async processString(input) {
    return input.replace(MIME_HEADER_PATTERN, (match, charset, encoding, text) => {
      try {
        const bytes = encoding.toUpperCase() === 'B'
          ? decodeBase64Bytes(text)
          : decodeQHeader(text);
        return new TextDecoder(charset, { fatal: true }).decode(bytes);
      } catch {
        throw new PipeError(`Cannot decode MIME encoded word: ${match}`);
      }
    });
  }
}
