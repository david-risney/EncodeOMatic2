/**
 * Hex encoding/decoding pipes.
 */

import { Pipe, PipeConfig, PipeError, PortDef } from '../../pipe.js';

export class HexEncodePipe extends Pipe {
  static typeName = 'HexEncode';
  static typeDescription = 'Hex Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to a hexadecimal string.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'separator',
        description: 'Separator between hex bytes (empty for none)',
        defaultValue: '',
        type: 'string',
      }),
      new PipeConfig({
        name: 'uppercase',
        description: 'Use uppercase hex digits',
        defaultValue: true,
        type: 'boolean',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const sep = this.getConfig('separator')?.value ?? '';
    const upper = this.getConfig('uppercase')?.value ?? true;
    const hexes = [];
    for (const byte of data) {
      let h = byte.toString(16).padStart(2, '0');
      if (upper) h = h.toUpperCase();
      hexes.push(h);
    }
    const out = hexes.join(sep);
    return new Map([['output', new TextEncoder().encode(out)]]);
  }
}

export class HexDecodePipe extends Pipe {
  static typeName = 'HexDecode';
  static typeDescription = 'Hex Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode a hexadecimal string to bytes.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    if (/[g-zG-Z]/.test(text)) return -10;
    const hexDigits = text.replace(/[^0-9a-fA-F]/g, '');
    return hexDigits.length > 0 && hexDigits.length % 2 === 0 ? 10 : -10;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data);
    // Strip whitespace and separators, keep only hex digits
    const cleaned = text.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length % 2 !== 0) {
      throw new PipeError('Hex string has odd number of digits');
    }
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      const val = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
      if (isNaN(val)) throw new PipeError(`Invalid hex byte at position ${i * 2}`);
      bytes[i] = val;
    }
    return new Map([['output', bytes]]);
  }
}
