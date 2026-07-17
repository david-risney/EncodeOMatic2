/**
 * Gzip and deflate compression pipes.
 */

import { Pipe, PipeError } from '../../pipe.js';

async function transformBytes(StreamClass, format, data) {
  const stream = new StreamClass(format);
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();

  const reader = stream.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

class CompressionPipe extends Pipe {
  static format = '';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const output = await transformBytes(CompressionStream, this.constructor.format, data);
    return new Map([['output', output]]);
  }
}

class DecompressionPipe extends Pipe {
  static format = '';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    try {
      const output = await transformBytes(DecompressionStream, this.constructor.format, data);
      return new Map([['output', output]]);
    } catch {
      throw new PipeError('Decompression failed: corrupt or invalid data');
    }
  }
}

export class GzipCompressPipe extends CompressionPipe {
  static typeName = 'GzipCompress';
  static typeDescription = 'Gzip Compress';
  static category = 'Encoding';
  static categoryDescription = 'Compress bytes using gzip.';
  static format = 'gzip';
}

export class GzipDecompressPipe extends DecompressionPipe {
  static typeName = 'GzipDecompress';
  static typeDescription = 'Gzip Decompress';
  static category = 'Encoding';
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
  static category = 'Encoding';
  static categoryDescription = 'Compress bytes using deflate.';
  static format = 'deflate';
}

export class DeflateDecompressPipe extends DecompressionPipe {
  static typeName = 'DeflateDecompress';
  static typeDescription = 'Deflate Decompress';
  static category = 'Encoding';
  static categoryDescription = 'Decompress deflate-compressed bytes.';
  static format = 'deflate';
}
