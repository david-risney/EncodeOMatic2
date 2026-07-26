import {
  createAdler32,
  createCRC32,
  createCRC64,
} from '../../../../vendor/hash-wasm.js';
import { HashWasmPipe } from './hash-wasm.js';

const CRC32C_POLYNOMIAL = 0x82f63b78;

export class Crc32Pipe extends HashWasmPipe {
  static typeName = 'Crc32';
  static typeDescription = 'CRC-32';
  static category = 'Encoding';
  static categoryDescription = 'Compute a CRC-32 checksum from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createCRC32, 'CRC-32 hashing failed');
  }
}

export class Crc32cPipe extends HashWasmPipe {
  static typeName = 'Crc32c';
  static typeDescription = 'CRC-32C';
  static category = 'Encoding';
  static categoryDescription = 'Compute a CRC-32C checksum from input bytes.';

  async process(inputs) {
    return this.processWithHasher(
      inputs,
      () => createCRC32(CRC32C_POLYNOMIAL),
      'CRC-32C hashing failed'
    );
  }
}

export class Crc64Pipe extends HashWasmPipe {
  static typeName = 'Crc64';
  static typeDescription = 'CRC-64';
  static category = 'Encoding';
  static categoryDescription = 'Compute a CRC-64 checksum from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createCRC64, 'CRC-64 hashing failed');
  }
}

export class Adler32Pipe extends HashWasmPipe {
  static typeName = 'Adler32';
  static typeDescription = 'Adler-32';
  static category = 'Encoding';
  static categoryDescription = 'Compute an Adler-32 checksum from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createAdler32, 'Adler-32 hashing failed');
  }
}

export const builtinPipes = [Crc32Pipe, Crc32cPipe, Crc64Pipe, Adler32Pipe];
