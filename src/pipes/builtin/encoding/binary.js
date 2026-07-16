/**
 * Binary (base-2) encoding/decoding pipes.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';

export class BinaryEncodePipe extends Pipe {
  static typeName = 'BinaryEncode';
  static typeDescription = 'Binary Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to a binary (base-2) bit string.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'separator',
        description: 'Separator between bytes (space, comma, none, etc.)',
        defaultValue: ' ',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const sep = this.getConfig('separator')?.value ?? ' ';
    const bits = [...data].map(b => b.toString(2).padStart(8, '0'));
    return new Map([['output', new TextEncoder().encode(bits.join(sep))]]);
  }
}

export class BinaryDecodePipe extends Pipe {
  static typeName = 'BinaryDecode';
  static typeDescription = 'Binary Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode a binary (base-2) bit string to bytes.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    const tokens = text.split(/[\s,]+/).filter(Boolean);
    if (!tokens.every(token => /^[01]+$/.test(token))) return -10;
    return tokens.every(token => token.length === 8) ? 10 : 5;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data);
    const tokens = [...text.matchAll(/[^\s,]+/g)];
    const bytes = new Uint8Array(tokens.length);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i][0];
      const val = parseInt(token, 2);
      if (isNaN(val) || token.replace(/[01]/g, '').length > 0) {
        const byteIndex = new TextEncoder().encode(text.slice(0, tokens[i].index)).length;
        const byteLength = new TextEncoder().encode(token).length;
        throw new PipeError(`Invalid binary byte at position ${i}: "${token}"`, [
          { index: byteIndex, length: byteLength },
        ]);
      }
      bytes[i] = val;
    }
    return new Map([['output', bytes]]);
  }
}
