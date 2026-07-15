/**
 * Base64 encode and decode pipes.
 */

import { Pipe, PipeError, PortDef } from '../../pipe.js';

export class Base64EncodePipe extends Pipe {
  static typeName = 'Base64Encode';
  static typeDescription = 'Base64 Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to a Base64 ASCII string.';

  defineOutputs() {
    return [new PortDef('output', 'Base64-encoded ASCII bytes', true)];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    // Convert Uint8Array to binary string, then base64
    let binary = '';
    for (const byte of data) {
      binary += String.fromCharCode(byte);
    }
    const b64 = btoa(binary);
    const encoder = new TextEncoder();
    return new Map([['output', encoder.encode(b64)]]);
  }
}

export class Base64DecodePipe extends Pipe {
  static typeName = 'Base64Decode';
  static typeDescription = 'Base64 Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode Base64 ASCII text to raw bytes.';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const decoder = new TextDecoder('ascii');
    const b64 = decoder.decode(data).trim();
    let binary;
    try {
      binary = atob(b64);
    } catch {
      throw new PipeError('Invalid Base64 input');
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Map([['output', bytes]]);
  }
}
