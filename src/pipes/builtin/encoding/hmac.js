import { Pipe, PipeError, PortDef, PipeConfig } from '../../pipe.js';
import {
  createBLAKE2b,
  createBLAKE2s,
  createBLAKE3,
  createHMAC,
  createKeccak,
  createMD4,
  createMD5,
  createRIPEMD160,
  createSHA1,
  createSHA224,
  createSHA256,
  createSHA3,
  createSHA384,
  createSHA512,
  createSM3,
  createWhirlpool,
} from '../../../../vendor/hash-wasm.js';
import { wrapHashError } from './hash-wasm.js';

const HMAC_ALGORITHMS = new Map([
  ['SHA-1', () => createSHA1()],
  ['SHA-224', () => createSHA224()],
  ['SHA-256', () => createSHA256()],
  ['SHA-384', () => createSHA384()],
  ['SHA-512', () => createSHA512()],
  ['SHA3-224', () => createSHA3(224)],
  ['SHA3-256', () => createSHA3(256)],
  ['SHA3-384', () => createSHA3(384)],
  ['SHA3-512', () => createSHA3(512)],
  ['Keccak-224', () => createKeccak(224)],
  ['Keccak-256', () => createKeccak(256)],
  ['Keccak-384', () => createKeccak(384)],
  ['Keccak-512', () => createKeccak(512)],
  ['MD4', () => createMD4()],
  ['MD5', () => createMD5()],
  ['RIPEMD-160', () => createRIPEMD160()],
  ['BLAKE2b-512', () => createBLAKE2b(512)],
  ['BLAKE2s-256', () => createBLAKE2s(256)],
  ['BLAKE3-256', () => createBLAKE3(256)],
  ['SM3', () => createSM3()],
  ['Whirlpool', () => createWhirlpool()],
]);

export class HmacPipe extends Pipe {
  static typeName = 'Hmac';
  static typeDescription = 'HMAC';
  static category = 'Hashing';
  static categoryDescription = 'Compute an HMAC digest using a key.';

  defineInputs() {
    return [
      new PortDef('input', 'Message bytes', true),
      new PortDef('key', 'HMAC key bytes'),
    ];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'algorithm',
        description: 'Digest algorithm',
        defaultValue: 'SHA-256',
        type: 'select',
        options: [...HMAC_ALGORITHMS.keys()],
      }),
    ];
  }

  async process(inputs) {
    const message = inputs.get('input') ?? new Uint8Array(0);
    const keyData = inputs.get('key');
    if (!keyData || keyData.length === 0) {
      throw new PipeError('HMAC key is required');
    }

    try {
      const algorithm = this.getConfig('algorithm')?.value ?? 'SHA-256';
      const hmac = await createHMAC(HMAC_ALGORITHMS.get(algorithm)(), keyData);
      hmac.init();
      hmac.update(message);
      return new Map([['output', hmac.digest('binary')]]);
    } catch (error) {
      throw wrapHashError(error, 'HMAC hashing failed');
    }
  }
}
