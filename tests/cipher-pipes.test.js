import { describe, expect, it } from 'vitest';
import { CipherDecryptPipe, CipherEncryptPipe } from '../src/pipes/builtin/encoding/cipher.js';

const bytes = (...values) => Uint8Array.from(values);
const key = bytes(...Array.from({ length: 32 }, (_, index) => index));
const input = bytes(...Array.from({ length: 23 }, (_, index) => index + 1));

const nonceFor = {
  'AES-GCM': 12,
  'AES-GCM-SIV': 12,
  'AES-CTR': 16,
  'AES-CFB': 16,
  'AES-CBC': 16,
  ChaCha20: 12,
  'ChaCha20-Original': 8,
  XChaCha20: 24,
  ChaCha8: 12,
  ChaCha12: 12,
  'ChaCha20-Poly1305': 12,
  'XChaCha20-Poly1305': 24,
  Salsa20: 8,
  XSalsa20: 24,
  'XSalsa20-Poly1305': 24,
};

function inputs(algorithm, data, keyData = key) {
  const nonceLength = nonceFor[algorithm];
  return new Map([
    ['input', data],
    ['key', keyData],
    ['nonce', bytes(...Array.from({ length: nonceLength ?? 0 }, (_, index) => index + 32))],
    ['associatedData', bytes(9, 8, 7)],
  ]);
}

describe('cipher pipes', () => {
  it('exposes the complete cipher selection and byte ports', () => {
    const pipe = new CipherEncryptPipe();
    expect(pipe.configs.get('algorithm').value).toBe('XChaCha20-Poly1305');
    expect(pipe.configs.get('algorithm').options).toHaveLength(20);
    expect(pipe.defineInputs().map(({ name }) => name))
      .toEqual(['input', 'key', 'nonce', 'associatedData']);
  });

  it.each([
    'AES-GCM', 'AES-GCM-SIV', 'AES-SIV', 'AES-CTR', 'AES-CFB', 'AES-CBC', 'AES-ECB',
    'AES-KW', 'AES-KWP', 'ChaCha20', 'ChaCha20-Original', 'XChaCha20', 'ChaCha8',
    'ChaCha12', 'ChaCha20-Poly1305', 'XChaCha20-Poly1305', 'Salsa20', 'XSalsa20',
    'XSalsa20-Poly1305', 'FF1',
  ])('round-trips %s', async (algorithm) => {
    const plaintext = algorithm === 'AES-KW' ? bytes(...Array.from({ length: 16 }, (_, index) => index)) : input;
    const algorithmKey = algorithm === 'AES-SIV' ? bytes(...Array.from({ length: 64 }, (_, index) => index)) : key;
    const encrypt = new CipherEncryptPipe();
    const decrypt = new CipherDecryptPipe();
    encrypt.setConfig('algorithm', algorithm);
    decrypt.setConfig('algorithm', algorithm);

    const ciphertext = (await encrypt.process(inputs(algorithm, plaintext, algorithmKey))).get('output');
    const result = (await decrypt.process(inputs(algorithm, ciphertext, algorithmKey))).get('output');

    expect(result).toEqual(plaintext);
  });

  it('matches the NIST AES-GCM test vector', async () => {
    const encrypt = new CipherEncryptPipe();
    encrypt.setConfig('algorithm', 'AES-GCM');
    const ciphertext = (await encrypt.process(new Map([
      ['input', new Uint8Array(16)],
      ['key', new Uint8Array(16)],
      ['nonce', new Uint8Array(12)],
    ]))).get('output');

    expect([...ciphertext]).toEqual([
      0x03, 0x88, 0xda, 0xce, 0x60, 0xb6, 0xa3, 0x92, 0xf3, 0x28, 0xc2, 0xb9,
      0x71, 0xb2, 0xfe, 0x78, 0xab, 0x6e, 0x47, 0xd4, 0x2c, 0xec, 0x13, 0xbd,
      0xf5, 0x3a, 0x67, 0xb2, 0x12, 0x57, 0xbd, 0xdf,
    ]);
  });

  it('reports required key, nonce, and authenticated ciphertext failures', async () => {
    const encrypt = new CipherEncryptPipe();
    await expect(encrypt.process(new Map())).rejects.toMatchObject({ message: 'Encryption key is required' });

    encrypt.setConfig('algorithm', 'AES-GCM');
    await expect(encrypt.process(new Map([['key', key]])))
      .rejects.toMatchObject({ message: 'AES-GCM requires a 12-byte nonce or IV' });

    const decrypt = new CipherDecryptPipe();
    decrypt.setConfig('algorithm', 'XChaCha20-Poly1305');
    await expect(decrypt.process(inputs('XChaCha20-Poly1305', bytes(1, 2, 3))))
      .rejects.toMatchObject({ message: expect.stringContaining('decryption failed') });
  });
});
