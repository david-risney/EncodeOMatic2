import {
  createBLAKE2b,
  createBLAKE2s,
  createBLAKE3,
} from '../../../../vendor/hash-wasm.js';
import { HashWasmPipe, getNumberConfig, numberConfig } from './hash-wasm.js';

function validateBits(bits, minimum, maximum, algorithm) {
  if (!Number.isInteger(bits) || bits < minimum || bits > maximum || bits % 8 !== 0) {
    throw new Error(`${algorithm} output bits must be a multiple of 8 between ${minimum} and ${maximum}`);
  }
}

function validateBlake3Bits(bits) {
  if (!Number.isInteger(bits) || bits < 8 || bits % 8 !== 0) {
    throw new Error('BLAKE3 output bits must be a positive multiple of 8');
  }
}

export class Blake2bHashPipe extends HashWasmPipe {
  static typeName = 'Blake2bHash';
  static typeDescription = 'BLAKE2b Hash';
  static category = 'Encoding';
  static categoryDescription = 'Compute a BLAKE2b digest from input bytes.';

  defineConfigs() {
    return [
      numberConfig('bits', 'Output bits', 512),
    ];
  }

  async process(inputs) {
    const bits = getNumberConfig(this, 'bits', 512);
    validateBits(bits, 8, 512, 'BLAKE2b');
    return this.processWithHasher(inputs, () => createBLAKE2b(bits), 'BLAKE2b hashing failed');
  }
}

export class Blake2sHashPipe extends HashWasmPipe {
  static typeName = 'Blake2sHash';
  static typeDescription = 'BLAKE2s Hash';
  static category = 'Encoding';
  static categoryDescription = 'Compute a BLAKE2s digest from input bytes.';

  defineConfigs() {
    return [
      numberConfig('bits', 'Output bits', 256),
    ];
  }

  async process(inputs) {
    const bits = getNumberConfig(this, 'bits', 256);
    validateBits(bits, 8, 256, 'BLAKE2s');
    return this.processWithHasher(inputs, () => createBLAKE2s(bits), 'BLAKE2s hashing failed');
  }
}

export class Blake3HashPipe extends HashWasmPipe {
  static typeName = 'Blake3Hash';
  static typeDescription = 'BLAKE3 Hash';
  static category = 'Encoding';
  static categoryDescription = 'Compute a BLAKE3 digest from input bytes.';

  defineConfigs() {
    return [
      numberConfig('bits', 'Output bits', 256),
    ];
  }

  async process(inputs) {
    const bits = getNumberConfig(this, 'bits', 256);
    validateBlake3Bits(bits);
    return this.processWithHasher(inputs, () => createBLAKE3(bits), 'BLAKE3 hashing failed');
  }
}
