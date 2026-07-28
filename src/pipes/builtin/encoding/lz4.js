/**
 * LZ4 compression and decompression pipes using lz4js.
 */

import { Pipe, PipeError } from '../../pipe.js';
import { compress, decompress } from '../../../../vendor/lz4.js';

export class Lz4CompressPipe extends Pipe {
  static typeName = 'Lz4Compress';
  static typeDescription = 'LZ4 Compress';
  static category = 'Compression';
  static categoryDescription = 'Compress bytes using LZ4.';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const output = compress(data instanceof Uint8Array ? data : new Uint8Array(data));
    return new Map([['output', output]]);
  }
}

export class Lz4DecompressPipe extends Pipe {
  static typeName = 'Lz4Decompress';
  static typeDescription = 'LZ4 Decompress';
  static category = 'Compression';
  static categoryDescription = 'Decompress LZ4-compressed bytes.';

  static getInputAppropriateness(input) {
    // LZ4 frame magic: 0x04 0x22 0x4D 0x18
    if (input?.length >= 4 && input[0] === 0x04 && input[1] === 0x22 && input[2] === 0x4d && input[3] === 0x18) {
      return 8;
    }
    return 0;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    try {
      const output = decompress(data instanceof Uint8Array ? data : new Uint8Array(data));
      return new Map([['output', output]]);
    } catch {
      throw new PipeError('LZ4 decompression failed: corrupt or invalid data');
    }
  }
}

export const builtinPipes = [Lz4CompressPipe, Lz4DecompressPipe];
