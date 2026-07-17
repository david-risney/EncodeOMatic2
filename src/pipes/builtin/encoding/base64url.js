/**
 * Base64url encode and decode pipes.
 */

import { Pipe, PipeError, PortDef } from '../../pipe.js';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const TEXT_ENCODER = new TextEncoder();

function toBinaryString(data) {
  let binary = '';
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return binary;
}

function normalizeBase64url(text) {
  if (!/^[A-Za-z0-9_-]*={0,2}$/u.test(text)) {
    throw new PipeError('Invalid Base64url input');
  }

  const unpadded = text
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .replace(/=+$/u, '');

  if (unpadded.length % 4 === 1) {
    throw new PipeError('Invalid Base64url input');
  }

  return unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
}

export class Base64urlEncodePipe extends Pipe {
  static typeName = 'Base64urlEncode';
  static typeDescription = 'Base64url Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to a Base64url ASCII string.';

  defineOutputs() {
    return [new PortDef('output', 'Base64url-encoded ASCII bytes', true)];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const encoded = btoa(toBinaryString(data))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/u, '');
    return new Map([['output', TEXT_ENCODER.encode(encoded)]]);
  }
}

export class Base64urlDecodePipe extends Pipe {
  static typeName = 'Base64urlDecode';
  static typeDescription = 'Base64url Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode Base64url ASCII text to raw bytes.';

  static getInputAppropriateness(input) {
    if (input == null) return 0;

    let text;
    try {
      text = UTF8_DECODER.decode(input).trim();
    } catch {
      return -10;
    }

    if (text.length === 0) return 0;
    if (!/^[A-Za-z0-9_-]+=*$/u.test(text)) {
      return -10;
    }

    try {
      atob(normalizeBase64url(text));
      return 10;
    } catch {
      return -10;
    }
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);

    let text;
    try {
      text = UTF8_DECODER.decode(data).trim();
    } catch {
      throw new PipeError('Invalid Base64url input');
    }

    let binary;
    try {
      binary = atob(normalizeBase64url(text));
    } catch {
      throw new PipeError('Invalid Base64url input');
    }

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Map([['output', bytes]]);
  }
}
