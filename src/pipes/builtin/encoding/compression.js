/**
 * Gzip and deflate compression pipes.
 */

import { Pipe, PipeError } from '../../pipe.js';

async function transformBytes(StreamClass, format, data) {
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const transformed = input.pipeThrough(new StreamClass(format));
  const output = await new Response(transformed).arrayBuffer();
  return new Uint8Array(output);
}

class CompressionPipe extends Pipe {
  static format = '';

  async process(inputs) {
    if (typeof globalThis.CompressionStream !== 'function') {
      throw new PipeError('Compression is not supported in this environment');
    }
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const output = await transformBytes(globalThis.CompressionStream, this.constructor.format, data);
    return new Map([['output', output]]);
  }
}

class DecompressionPipe extends Pipe {
  static format = '';

  async process(inputs) {
    if (typeof globalThis.DecompressionStream !== 'function') {
      throw new PipeError('Decompression is not supported in this environment');
    }
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    try {
      const output = await transformBytes(globalThis.DecompressionStream, this.constructor.format, data);
      return new Map([['output', output]]);
    } catch {
      throw new PipeError('Decompression failed: corrupt or invalid data');
    }
  }
}

export class GzipCompressPipe extends CompressionPipe {
  static typeName = 'GzipCompress';
  static typeDescription = 'Gzip Compress';
  static category = 'Compression';
  static categoryDescription = 'Compress bytes using gzip.';
  static format = 'gzip';
}

export class GzipDecompressPipe extends DecompressionPipe {
  static typeName = 'GzipDecompress';
  static typeDescription = 'Gzip Decompress';
  static category = 'Compression';
  static categoryDescription = 'Decompress gzip-compressed bytes.';
  static format = 'gzip';

  static getInputAppropriateness(input) {
    if (input?.length >= 2 && input[0] === 0x1f && input[1] === 0x8b) {
      return 8;
    }
    return 0;
  }
}

export class DeflateCompressPipe extends CompressionPipe {
  static typeName = 'DeflateCompress';
  static typeDescription = 'Deflate Compress';
  static category = 'Compression';
  static categoryDescription = 'Compress bytes using deflate.';
  static format = 'deflate';
}

export class DeflateDecompressPipe extends DecompressionPipe {
  static typeName = 'DeflateDecompress';
  static typeDescription = 'Deflate Decompress';
  static category = 'Compression';
  static categoryDescription = 'Decompress deflate-compressed bytes.';
  static format = 'deflate';

  static getInputAppropriateness(input) {
    if (!input || input.length < 2) return 0;
    // Zlib header: CM=8 (deflate), CINFO≤7, and (CMF*256+FLG) % 31 === 0
    const cm = input[0] & 0x0F;
    const cinfo = input[0] >> 4;
    if (cm === 8 && cinfo <= 7 && (input[0] * 256 + input[1]) % 31 === 0) return 8;
    return 0;
  }
}

export class DeflateRawCompressPipe extends CompressionPipe {
  static typeName = 'DeflateRawCompress';
  static typeDescription = 'Deflate Raw Compress';
  static category = 'Compression';
  static categoryDescription = 'Compress bytes using raw deflate (no zlib wrapper).';
  static format = 'deflate-raw';
}

export class DeflateRawDecompressPipe extends DecompressionPipe {
  static typeName = 'DeflateRawDecompress';
  static typeDescription = 'Deflate Raw Decompress';
  static category = 'Compression';
  static categoryDescription = 'Decompress raw deflate-compressed bytes (no zlib wrapper).';
  static format = 'deflate-raw';

  static getInputAppropriateness(input) {
    if (!input || input.length < 2) return 0;
    // Exclude gzip magic bytes (handled by GzipDecompressPipe)
    if (input[0] === 0x1f && input[1] === 0x8b) return 0;
    // Exclude valid zlib header (handled by DeflateDecompressPipe)
    const cm = input[0] & 0x0F;
    const cinfo = input[0] >> 4;
    if (cm === 8 && cinfo <= 7 && (input[0] * 256 + input[1]) % 31 === 0) return 0;
    // Valid raw deflate: BTYPE bits (1-2) must not be 11 (reserved/invalid)
    const btype = (input[0] >> 1) & 0x3;
    return btype !== 3 ? 8 : 0;
  }
}

export const builtinPipes = [
  GzipCompressPipe, GzipDecompressPipe,
  DeflateCompressPipe, DeflateDecompressPipe,
  DeflateRawCompressPipe, DeflateRawDecompressPipe,
];
