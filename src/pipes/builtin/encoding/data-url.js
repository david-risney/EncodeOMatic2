/**
 * Data URL (RFC 2397) encode and decode pipes.
 *
 * Encoding wraps input bytes in a `data:` URL using either Base64 or
 * percent-encoding. Decoding extracts the media type and the raw bytes.
 */

import { Pipe, PipeConfig, PipeError, PortDef } from '../../pipe.js';
import { binaryStringToBytes, bytesToBinaryString } from './binary-string.js';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const UTF8_ENCODER = new TextEncoder();

// data:[<mediatype>][;base64],<data>
const DATA_URL_PATTERN = /^data:([^,]*),([\s\S]*)$/i;


/** Percent-encode every byte that is not an RFC 3986 unreserved character. */
function percentEncodeBytes(data) {
  let out = '';
  for (const byte of data) {
    const char = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-._~!$&'()*+,;=:@/?]/.test(char)) {
      out += char;
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return out;
}

function percentDecodeToBytes(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '%') {
      const hex = text.slice(i + 1, i + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
        throw new PipeError(`Invalid percent escape in data URL at position ${i}`);
      }
      bytes.push(parseInt(hex, 16));
      i += 2;
      continue;
    }
    const code = text.codePointAt(i);
    if (code > 0x7f) {
      // Non-ASCII characters are carried through as UTF-8 bytes.
      const codePoint = String.fromCodePoint(code);
      for (const byte of UTF8_ENCODER.encode(codePoint)) {
        bytes.push(byte);
      }
      i += codePoint.length - 1;
      continue;
    }
    bytes.push(code);
  }
  return new Uint8Array(bytes);
}

export class DataUrlEncodePipe extends Pipe {
  static typeName = 'DataUrlEncode';
  static typeDescription = 'Data URL Encode';
  static category = 'URL Encoding';
  static categoryDescription = 'Wrap bytes in an RFC 2397 data: URL.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'mediaType',
        description: 'Media type for the data URL (may include parameters such as ;charset=utf-8)',
        defaultValue: 'text/plain;charset=utf-8',
        type: 'string',
      }),
      new PipeConfig({
        name: 'encoding',
        description: 'How to encode the payload in the data URL',
        defaultValue: 'base64',
        type: 'select',
        options: ['base64', 'percent'],
      }),
    ];
  }

  defineOutputs() {
    return [new PortDef('output', 'data: URL text bytes', true)];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const mediaType = (this.getConfig('mediaType')?.value ?? '').trim();
    const encoding = this.getConfig('encoding')?.value ?? 'base64';

    const payload = encoding === 'base64'
      ? btoa(bytesToBinaryString(data))
      : percentEncodeBytes(data);
    const suffix = encoding === 'base64' ? ';base64' : '';

    return new Map([['output', UTF8_ENCODER.encode(`data:${mediaType}${suffix},${payload}`)]]);
  }
}

export class DataUrlDecodePipe extends Pipe {
  static typeName = 'DataUrlDecode';
  static typeDescription = 'Data URL Decode';
  static category = 'URL Encoding';
  static categoryDescription = 'Extract the media type and bytes from an RFC 2397 data: URL.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = UTF8_DECODER.decode(input).trim();
    } catch {
      return -10;
    }
    if (!/^data:/i.test(text)) return 0;
    return DATA_URL_PATTERN.test(text) ? 10 : -10;
  }

  defineOutputs() {
    return [
      new PortDef('output', 'Decoded data URL payload bytes', true),
      new PortDef('mediaType', 'Media type declared in the data URL'),
      new PortDef('encoding', 'Payload encoding: base64 or percent'),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    let text;
    try {
      text = UTF8_DECODER.decode(data).trim();
    } catch {
      throw new PipeError('Data URL input is not valid UTF-8 text');
    }

    const match = text.match(DATA_URL_PATTERN);
    if (!match) {
      throw new PipeError('Invalid data URL: expected data:[<mediatype>][;base64],<data>');
    }

    const [, header, payload] = match;
    const isBase64 = /;\s*base64\s*$/i.test(header);
    const mediaType = (isBase64 ? header.replace(/;\s*base64\s*$/i, '') : header).trim();

    let bytes;
    if (isBase64) {
      try {
        bytes = binaryStringToBytes(atob(payload.replace(/\s+/g, '')));
      } catch {
        throw new PipeError('Invalid Base64 payload in data URL');
      }
    } else {
      bytes = percentDecodeToBytes(payload);
    }

    return new Map([
      ['output', bytes],
      ['mediaType', UTF8_ENCODER.encode(mediaType || 'text/plain;charset=US-ASCII')],
      ['encoding', UTF8_ENCODER.encode(isBase64 ? 'base64' : 'percent')],
    ]);
  }
}

export const builtinPipes = [DataUrlEncodePipe, DataUrlDecodePipe];
