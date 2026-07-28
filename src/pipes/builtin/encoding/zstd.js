/**
 * Zstandard decompression pipe using zstd-wasm.
 * Compression is not provided because zstd-wasm only exports a Decompressor.
 */

import { Pipe, PipeError } from '../../pipe.js';
import { Decompressor } from '../../../../vendor/zstd.js';

let decompressor = null;

async function getDecompressor() {
  if (!decompressor) {
    decompressor = await new Decompressor().init();
  }
  return decompressor;
}

export class ZstdDecompressPipe extends Pipe {
  static typeName = 'ZstdDecompress';
  static typeDescription = 'Zstd Decompress';
  static category = 'Compression';
  static categoryDescription = 'Decompress Zstandard-compressed bytes.';

  static getInputAppropriateness(input) {
    // Zstd frame magic: 0x28 0xB5 0x2F 0xFD (little-endian 0xFD2FB528)
    if (input?.length >= 4 && input[0] === 0x28 && input[1] === 0xb5 && input[2] === 0x2f && input[3] === 0xfd) {
      return 8;
    }
    return 0;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    try {
      const d = await getDecompressor();
      const output = d.decompress(data instanceof Uint8Array ? data : new Uint8Array(data));
      return new Map([['output', output]]);
    } catch {
      throw new PipeError('Zstd decompression failed: corrupt or invalid data');
    }
  }
}

export const builtinPipes = [ZstdDecompressPipe];
