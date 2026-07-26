import {
  createXXHash32,
  createXXHash64,
  createXXHash3,
  createXXHash128,
} from '../../../../vendor/hash-wasm.js';
import { HashWasmPipe, getNumberConfig, numberConfig } from './hash-wasm.js';

function getSeed32(pipe, name = 'seed') {
  return getNumberConfig(pipe, name, 0) >>> 0;
}

function getSeed64(pipe) {
  return {
    low: getNumberConfig(pipe, 'seedLow', 0) >>> 0,
    high: getNumberConfig(pipe, 'seedHigh', 0) >>> 0,
  };
}

export class XxHash32Pipe extends HashWasmPipe {
  static typeName = 'XxHash32';
  static typeDescription = 'xxHash32';
  static category = 'Hashing';
  static categoryDescription = 'Compute an xxHash32 digest from input bytes.';

  defineConfigs() {
    return [
      numberConfig('seed', 'Seed', 0),
    ];
  }

  async process(inputs) {
    const seed = getSeed32(this);
    return this.processWithHasher(inputs, () => createXXHash32(seed), 'xxHash32 hashing failed');
  }
}

export class XxHash64Pipe extends HashWasmPipe {
  static typeName = 'XxHash64';
  static typeDescription = 'xxHash64';
  static category = 'Hashing';
  static categoryDescription = 'Compute an xxHash64 digest from input bytes.';

  defineConfigs() {
    return [
      numberConfig('seedLow', 'Seed low 32 bits', 0),
      numberConfig('seedHigh', 'Seed high 32 bits', 0),
    ];
  }

  async process(inputs) {
    const { low, high } = getSeed64(this);
    return this.processWithHasher(inputs, () => createXXHash64(low, high), 'xxHash64 hashing failed');
  }
}

export class XxHash3Pipe extends HashWasmPipe {
  static typeName = 'XxHash3';
  static typeDescription = 'xxHash3';
  static category = 'Hashing';
  static categoryDescription = 'Compute an xxHash3 digest from input bytes.';

  defineConfigs() {
    return [
      numberConfig('seedLow', 'Seed low 32 bits', 0),
      numberConfig('seedHigh', 'Seed high 32 bits', 0),
    ];
  }

  async process(inputs) {
    const { low, high } = getSeed64(this);
    return this.processWithHasher(inputs, () => createXXHash3(low, high), 'xxHash3 hashing failed');
  }
}

export class XxHash128Pipe extends HashWasmPipe {
  static typeName = 'XxHash128';
  static typeDescription = 'xxHash128';
  static category = 'Hashing';
  static categoryDescription = 'Compute an xxHash128 digest from input bytes.';

  defineConfigs() {
    return [
      numberConfig('seedLow', 'Seed low 32 bits', 0),
      numberConfig('seedHigh', 'Seed high 32 bits', 0),
    ];
  }

  async process(inputs) {
    const { low, high } = getSeed64(this);
    return this.processWithHasher(inputs, () => createXXHash128(low, high), 'xxHash128 hashing failed');
  }
}
