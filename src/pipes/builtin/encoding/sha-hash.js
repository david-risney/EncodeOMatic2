import {
  createKeccak,
  createSHA1,
  createSHA224,
  createSHA256,
  createSHA3,
  createSHA384,
  createSHA512,
} from '../../../../vendor/hash-wasm.js';
import { HashWasmPipe, getNumberConfig, selectConfig } from './hash-wasm.js';

const SHA_ALGORITHMS = new Map([
  ['SHA-1', createSHA1],
  ['SHA-224', createSHA224],
  ['SHA-256', createSHA256],
  ['SHA-384', createSHA384],
  ['SHA-512', createSHA512],
]);

export class ShaHashPipe extends HashWasmPipe {
  static typeName = 'ShaHash';
  static typeDescription = 'SHA Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute a SHA digest from input bytes.';

  defineConfigs() {
    return [
      selectConfig('algorithm', 'SHA digest algorithm', 'SHA-256', [...SHA_ALGORITHMS.keys()]),
    ];
  }

  async process(inputs) {
    const algorithm = this.getConfig('algorithm')?.value ?? 'SHA-256';
    return this.processWithHasher(inputs, () => SHA_ALGORITHMS.get(algorithm)(), 'SHA hashing failed');
  }
}

export class Sha3HashPipe extends HashWasmPipe {
  static typeName = 'Sha3Hash';
  static typeDescription = 'SHA-3 Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute a SHA-3 digest from input bytes.';

  defineConfigs() {
    return [
      selectConfig('bits', 'SHA-3 output bits', '256', ['224', '256', '384', '512']),
    ];
  }

  async process(inputs) {
    const bits = getNumberConfig(this, 'bits', 256);
    return this.processWithHasher(inputs, () => createSHA3(bits), 'SHA-3 hashing failed');
  }
}

export class KeccakHashPipe extends HashWasmPipe {
  static typeName = 'KeccakHash';
  static typeDescription = 'Keccak Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute a Keccak digest from input bytes.';

  defineConfigs() {
    return [
      selectConfig('bits', 'Keccak output bits', '256', ['224', '256', '384', '512']),
    ];
  }

  async process(inputs) {
    const bits = getNumberConfig(this, 'bits', 256);
    return this.processWithHasher(inputs, () => createKeccak(bits), 'Keccak hashing failed');
  }
}

export const builtinPipes = [ShaHashPipe, Sha3HashPipe, KeccakHashPipe];
