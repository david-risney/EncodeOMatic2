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

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data);
    const tokens = text.trim().split(/[\s,]+/).filter(Boolean);
    const bytes = new Uint8Array(tokens.length);
    for (let i = 0; i < tokens.length; i++) {
      const val = parseInt(tokens[i], 2);
      if (isNaN(val) || tokens[i].replace(/[01]/g, '').length > 0) {
        throw new PipeError(`Invalid binary byte at position ${i}: "${tokens[i]}"`);
      }
      bytes[i] = val;
    }
    return new Map([['output', bytes]]);
  }
}
