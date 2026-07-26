import {
  createMD4,
  createMD5,
  createRIPEMD160,
  createSM3,
  createWhirlpool,
} from '../../../../vendor/hash-wasm.js';
import { HashWasmPipe } from './hash-wasm.js';

export class Md4HashPipe extends HashWasmPipe {
  static typeName = 'Md4Hash';
  static typeDescription = 'MD4 Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute an MD4 digest from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createMD4, 'MD4 hashing failed');
  }
}

export class Md5HashPipe extends HashWasmPipe {
  static typeName = 'Md5Hash';
  static typeDescription = 'MD5 Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute an MD5 digest from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createMD5, 'MD5 hashing failed');
  }
}

export class Ripemd160HashPipe extends HashWasmPipe {
  static typeName = 'Ripemd160Hash';
  static typeDescription = 'RIPEMD-160 Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute a RIPEMD-160 digest from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createRIPEMD160, 'RIPEMD-160 hashing failed');
  }
}

export class Sm3HashPipe extends HashWasmPipe {
  static typeName = 'Sm3Hash';
  static typeDescription = 'SM3 Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute an SM3 digest from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createSM3, 'SM3 hashing failed');
  }
}

export class WhirlpoolHashPipe extends HashWasmPipe {
  static typeName = 'WhirlpoolHash';
  static typeDescription = 'Whirlpool Hash';
  static category = 'Hashing';
  static categoryDescription = 'Compute a Whirlpool digest from input bytes.';

  async process(inputs) {
    return this.processWithHasher(inputs, createWhirlpool, 'Whirlpool hashing failed');
  }
}

export const builtinPipes = [Md4HashPipe, Md5HashPipe, Ripemd160HashPipe, Sm3HashPipe, WhirlpoolHashPipe];
