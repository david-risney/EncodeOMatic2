import { describe, expect, it } from 'vitest';
import { Blake2bHashPipe, Blake2sHashPipe, Blake3HashPipe } from '../src/pipes/builtin/encoding/blake.js';
import { Crc32cPipe, Crc64Pipe } from '../src/pipes/builtin/encoding/crc32.js';
import {
  Md4HashPipe,
  Ripemd160HashPipe,
  Sm3HashPipe,
  WhirlpoolHashPipe,
} from '../src/pipes/builtin/encoding/md5.js';
import { KeccakHashPipe, Sha3HashPipe } from '../src/pipes/builtin/encoding/sha-hash.js';
import { XxHash32Pipe, XxHash64Pipe, XxHash3Pipe, XxHash128Pipe } from '../src/pipes/builtin/encoding/xxhash.js';
import { encode, processBytes } from './helpers.js';

const hex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

describe('SHA-3 and Keccak hash pipes', () => {
  it('produces the expected SHA3-256 digest', async () => {
    expect(hex(await processBytes(new Sha3HashPipe(), encode('hello'))))
      .toBe('3338be694f50c5f338814986cdf0686453a888b84f424d792af4b9202398f392');
  });

  it('supports multiple output sizes', async () => {
    const pipe = new Sha3HashPipe();
    pipe.setConfig('bits', '512');
    expect((await processBytes(pipe, encode('hello'))).length).toBe(64);
  });

  it('produces the expected Keccak-256 digest', async () => {
    expect(hex(await processBytes(new KeccakHashPipe(), encode('hello'))))
      .toBe('1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8');
  });
});

describe('BLAKE hash pipes', () => {
  it('produces the expected default digests', async () => {
    expect(hex(await processBytes(new Blake2bHashPipe(), encode('hello'))))
      .toBe('e4cfa39a3d37be31c59609e807970799caa68a19bfaa15135f165085e01d41a65ba1e1b146aeb6bd0092b49eac214c103ccfa3a365954bbbe52f74a2b3620c94');
    expect(hex(await processBytes(new Blake2sHashPipe(), encode('hello'))))
      .toBe('19213bacc58dee6dbde3ceb9a47cbb330b3d86f8cca8997eb00be456f140ca25');
    expect(hex(await processBytes(new Blake3HashPipe(), encode('hello'))))
      .toBe('ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f');
  });

  it('honors configured output length', async () => {
    const pipe = new Blake3HashPipe();
    pipe.setConfig('bits', 160);
    expect(hex(await processBytes(pipe, encode('hello')))).toBe('ea8f163db38682925e4491c5e58d4bb3506ef8c1');
  });

  it('rejects invalid output lengths', async () => {
    const pipe = new Blake2sHashPipe();
    pipe.setConfig('bits', 257);
    await expect(processBytes(pipe, encode('hello'))).rejects
      .toMatchObject({ message: 'BLAKE2s output bits must be a multiple of 8 between 8 and 256' });
  });
});

describe('Additional cryptographic hash pipes', () => {
  it('produces the expected digests', async () => {
    expect(hex(await processBytes(new Md4HashPipe(), encode('hello'))))
      .toBe('866437cb7a794bce2b727acc0362ee27');
    expect(hex(await processBytes(new Ripemd160HashPipe(), encode('hello'))))
      .toBe('108f07b8382412612c048d07d13f814118445acd');
    expect(hex(await processBytes(new Sm3HashPipe(), encode('hello'))))
      .toBe('becbbfaae6548b8bf0cfcad5a27183cd1be6093b1cceccc303d9c61d0a645268');
    expect(hex(await processBytes(new WhirlpoolHashPipe(), encode('hello'))))
      .toBe('0a25f55d7308eca6b9567a7ed3bd1b46327f0f1ffdc804dd8bb5af40e88d78b88df0d002a89e2fdbd5876c523f1b67bc44e9f87047598e7548298ea1c81cfd73');
  });
});

describe('Additional checksum pipes', () => {
  it('produces the expected checksums', async () => {
    expect(hex(await processBytes(new Crc32cPipe(), encode('hello')))).toBe('9a71bb4c');
    expect(hex(await processBytes(new Crc64Pipe(), encode('hello')))).toBe('9b1edae5dbb937b1');
  });
});

describe('xxHash pipes', () => {
  it('produces the expected digests', async () => {
    expect(hex(await processBytes(new XxHash32Pipe(), encode('hello')))).toBe('fb0077f9');
    expect(hex(await processBytes(new XxHash64Pipe(), encode('hello')))).toBe('26c7827d889f6da3');
    expect(hex(await processBytes(new XxHash3Pipe(), encode('hello')))).toBe('9555e8555c62dcfd');
    expect(hex(await processBytes(new XxHash128Pipe(), encode('hello')))).toBe('b5e9c1ad071b3e7fc779cfaa5e523818');
  });

  it('uses seed configuration', async () => {
    const pipe = new XxHash64Pipe();
    pipe.setConfig('seedLow', 1);
    pipe.setConfig('seedHigh', 2);
    expect(hex(await processBytes(pipe, encode('hello')))).toBe('a79cd1438baf2200');
  });
});
