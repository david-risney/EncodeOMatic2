import { Pipe, PipeConfig, PipeError, PortDef } from '../../pipe.js';
import {
  aessiv,
  aeskw,
  aeskwp,
  cbc,
  cfb,
  ctr,
  ecb,
  gcm,
  gcmsiv,
  chacha8,
  chacha12,
  chacha20,
  chacha20orig,
  chacha20poly1305,
  xchacha20,
  xchacha20poly1305,
  BinaryFF1,
  salsa20,
  xsalsa20,
  xsalsa20poly1305,
} from '../../../../vendor/noble-ciphers.js';

const ALGORITHMS = new Map([
  ['AES-GCM', { nonceLength: 12, create: (key, nonce, aad) => gcm(key, nonce, aad) }],
  ['AES-GCM-SIV', { nonceLength: 12, create: (key, nonce, aad) => gcmsiv(key, nonce, aad) }],
  ['AES-SIV', { nonceLength: null, create: (key, _nonce, aad) => aessiv(key, aad) }],
  ['AES-CTR', { nonceLength: 16, create: (key, nonce) => ctr(key, nonce) }],
  ['AES-CFB', { nonceLength: 16, create: (key, nonce) => cfb(key, nonce) }],
  ['AES-CBC', { nonceLength: 16, create: (key, nonce) => cbc(key, nonce) }],
  ['AES-ECB', { nonceLength: null, create: (key) => ecb(key) }],
  ['AES-KW', { nonceLength: null, create: (key) => aeskw(key) }],
  ['AES-KWP', { nonceLength: null, create: (key) => aeskwp(key) }],
  ['ChaCha20', { nonceLength: 12, create: (key, nonce) => ({ encrypt: (data) => chacha20(key, nonce, data), decrypt: (data) => chacha20(key, nonce, data) }) }],
  ['ChaCha20-Original', { nonceLength: 8, create: (key, nonce) => ({ encrypt: (data) => chacha20orig(key, nonce, data), decrypt: (data) => chacha20orig(key, nonce, data) }) }],
  ['XChaCha20', { nonceLength: 24, create: (key, nonce) => ({ encrypt: (data) => xchacha20(key, nonce, data), decrypt: (data) => xchacha20(key, nonce, data) }) }],
  ['ChaCha8', { nonceLength: 12, create: (key, nonce) => ({ encrypt: (data) => chacha8(key, nonce, data), decrypt: (data) => chacha8(key, nonce, data) }) }],
  ['ChaCha12', { nonceLength: 12, create: (key, nonce) => ({ encrypt: (data) => chacha12(key, nonce, data), decrypt: (data) => chacha12(key, nonce, data) }) }],
  ['ChaCha20-Poly1305', { nonceLength: 12, create: (key, nonce, aad) => chacha20poly1305(key, nonce, aad) }],
  ['XChaCha20-Poly1305', { nonceLength: 24, create: (key, nonce, aad) => xchacha20poly1305(key, nonce, aad) }],
  ['Salsa20', { nonceLength: 8, create: (key, nonce) => ({ encrypt: (data) => salsa20(key, nonce, data), decrypt: (data) => salsa20(key, nonce, data) }) }],
  ['XSalsa20', { nonceLength: 24, create: (key, nonce) => ({ encrypt: (data) => xsalsa20(key, nonce, data), decrypt: (data) => xsalsa20(key, nonce, data) }) }],
  ['XSalsa20-Poly1305', { nonceLength: 24, create: (key, nonce) => xsalsa20poly1305(key, nonce) }],
  ['FF1', { nonceLength: null, create: (key, _nonce, aad) => BinaryFF1(key, aad) }],
]);

class CipherPipe extends Pipe {
  static category = 'Encryption';
  static categoryDescription = 'Encrypt or decrypt byte data with audited modern cipher implementations.';

  defineInputs() {
    return [
      new PortDef('input', 'Plaintext or ciphertext bytes', true),
      new PortDef('key', 'Encryption key bytes'),
      new PortDef('nonce', 'Nonce or IV bytes, where required'),
      new PortDef('associatedData', 'Additional authenticated data or FF1 tweak bytes'),
    ];
  }

  defineConfigs() {
    return [new PipeConfig({
      name: 'algorithm',
      description: 'Cipher algorithm',
      defaultValue: 'XChaCha20-Poly1305',
      type: 'select',
      options: [...ALGORITHMS.keys()],
    })];
  }

  processCipher(inputs, operation) {
    const input = inputs.get('input') ?? new Uint8Array(0);
    const key = inputs.get('key');
    const nonce = inputs.get('nonce') ?? new Uint8Array(0);
    const associatedData = inputs.get('associatedData') ?? new Uint8Array(0);
    const algorithmName = this.getConfig('algorithm').value;
    const algorithm = ALGORITHMS.get(algorithmName);

    if (!algorithm) {
      throw new PipeError(`Unsupported cipher algorithm: ${algorithmName}`);
    }
    if (!key?.length) {
      throw new PipeError('Encryption key is required');
    }
    if (algorithm.nonceLength !== null && nonce.length !== algorithm.nonceLength) {
      throw new PipeError(`${algorithmName} requires a ${algorithm.nonceLength}-byte nonce or IV`);
    }

    try {
      return new Map([['output', algorithm.create(key, nonce, associatedData)[operation](input)]]);
    } catch (error) {
      throw new PipeError(`${algorithmName} ${operation === 'encrypt' ? 'encryption' : 'decryption'} failed: ${error.message}`);
    }
  }
}

export class CipherEncryptPipe extends CipherPipe {
  static typeName = 'CipherEncrypt';
  static typeDescription = 'Cipher Encrypt';

  async process(inputs) {
    return this.processCipher(inputs, 'encrypt');
  }
}

export class CipherDecryptPipe extends CipherPipe {
  static typeName = 'CipherDecrypt';
  static typeDescription = 'Cipher Decrypt';

  async process(inputs) {
    return this.processCipher(inputs, 'decrypt');
  }
}

export const builtinPipes = [CipherEncryptPipe, CipherDecryptPipe];
