/**
 * Brotli compression and decompression pipes using brotli-wasm.
 *
 * The brotli_wasm_bg.wasm file must be served at vendor/brotli_wasm_bg.wasm.
 */

import { Pipe, PipeError } from '../../pipe.js';
import { compress, decompress, initBrotli } from '../../../../vendor/brotli.js';

export class BrotliCompressPipe extends Pipe {
  static typeName = 'BrotliCompress';
  static typeDescription = 'Brotli Compress';
  static category = 'Compression';
  static categoryDescription = 'Compress bytes using Brotli.';

  async process(inputs) {
    await initBrotli();
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const output = compress(data instanceof Uint8Array ? data : new Uint8Array(data));
    return new Map([['output', output]]);
  }
}

export class BrotliDecompressPipe extends Pipe {
  static typeName = 'BrotliDecompress';
  static typeDescription = 'Brotli Decompress';
  static category = 'Compression';
  static categoryDescription = 'Decompress Brotli-compressed bytes.';

  async process(inputs) {
    await initBrotli();
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    try {
      const output = decompress(data instanceof Uint8Array ? data : new Uint8Array(data));
      return new Map([['output', output]]);
    } catch {
      throw new PipeError('Brotli decompression failed: corrupt or invalid data');
    }
  }
}

export const builtinPipes = [BrotliCompressPipe, BrotliDecompressPipe];
