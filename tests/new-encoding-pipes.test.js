import { describe, expect, it, vi } from 'vitest';
import { Base64urlEncodePipe, Base64urlDecodePipe } from '../src/pipes/builtin/encoding/base64url.js';
import {
  GzipCompressPipe,
  GzipDecompressPipe,
  DeflateCompressPipe,
  DeflateDecompressPipe,
} from '../src/pipes/builtin/encoding/compression.js';
import {
  FormUrlencodedEncodePipe,
  FormUrlencodedDecodePipe,
} from '../src/pipes/builtin/encoding/form-urlencoded.js';
import { HmacPipe } from '../src/pipes/builtin/encoding/hmac.js';
import { MimeHeaderDecodePipe } from '../src/pipes/builtin/encoding/mime-header.js';
import { ShaHashPipe } from '../src/pipes/builtin/encoding/sha-hash.js';
import {
  UnicodeEscapeEncodePipe,
  UnicodeEscapeDecodePipe,
} from '../src/pipes/builtin/encoding/unicode-escape.js';
import { UnicodeNormalizePipe } from '../src/pipes/builtin/encoding/unicode-normalize.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('Base64url encoding', () => {
  it('exposes expected default configuration', () => {
    expect(new Base64urlEncodePipe().configs.size).toBe(0);
    expect(new Base64urlDecodePipe().configs.size).toBe(0);
  });

  it('encodes bytes to URL-safe Base64 without padding', async () => {
    expect(decode(await processBytes(new Base64urlEncodePipe(), [0xff, 0xfe]))).toBe('__4');
    expect(decode(await processBytes(new Base64urlEncodePipe(), [0, 1, 2]))).toBe('AAEC');
    expect(decode(await processBytes(new Base64urlEncodePipe(), [0xfb]))).toBe('-w');
  });

  it('decodes Base64url text (padded and unpadded) to bytes', async () => {
    expect([...await processBytes(new Base64urlDecodePipe(), encode('__4'))]).toEqual([0xff, 0xfe]);
    expect([...await processBytes(new Base64urlDecodePipe(), encode('__4='))]).toEqual([0xff, 0xfe]);
    expect([...await processBytes(new Base64urlDecodePipe(), encode('AAEC'))]).toEqual([0, 1, 2]);
    expect([...await processBytes(new Base64urlDecodePipe(), encode('-w=='))]).toEqual([0xfb]);
  });

  it('round trips arbitrary bytes', async () => {
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    const encoded = await processBytes(new Base64urlEncodePipe(), bytes);
    expect([...await processBytes(new Base64urlDecodePipe(), encoded)]).toEqual(bytes);
  });

  it('handles empty input', async () => {
    expect(decode(await processBytes(new Base64urlEncodePipe(), []))).toBe('');
    expect([...await processBytes(new Base64urlDecodePipe(), [])]).toEqual([]);
  });

  it('strips leading/trailing whitespace when decoding', async () => {
    expect([...await processBytes(new Base64urlDecodePipe(), encode('  AAEC  \n'))]).toEqual([0, 1, 2]);
  });

  it('rejects invalid Base64url characters', async () => {
    await expect(processText(new Base64urlDecodePipe(), '+/8=')).rejects
      .toMatchObject({ message: 'Invalid Base64url input' });
    await expect(processText(new Base64urlDecodePipe(), '!@#$')).rejects
      .toMatchObject({ message: 'Invalid Base64url input' });
  });

  it('rejects invalid length (length % 4 === 1)', async () => {
    await expect(processText(new Base64urlDecodePipe(), 'A')).rejects
      .toMatchObject({ message: 'Invalid Base64url input' });
  });

  it('rejects non-UTF-8 input bytes', async () => {
    await expect(processBytes(new Base64urlDecodePipe(), [0xff])).rejects
      .toMatchObject({ message: 'Invalid Base64url input' });
  });

  it('scores decode appropriateness correctly', () => {
    expect(Base64urlDecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(Base64urlDecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(Base64urlDecodePipe.getInputAppropriateness(encode('AAEC'))).toBe(10);
    expect(Base64urlDecodePipe.getInputAppropriateness(encode('__4'))).toBe(10);
    expect(Base64urlDecodePipe.getInputAppropriateness(encode('+/8='))).toBe(-10);
    expect(Base64urlDecodePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('Compression (gzip and deflate)', () => {
  it('gzip compresses and decompresses text round trip', async () => {
    const compressed = await processBytes(new GzipCompressPipe(), encode('Hello, world!'));
    expect(compressed[0]).toBe(0x1f);
    expect(compressed[1]).toBe(0x8b);
    const decompressed = await processBytes(new GzipDecompressPipe(), compressed);
    expect(decode(decompressed)).toBe('Hello, world!');
  });

  it('deflate compresses and decompresses text round trip', async () => {
    const compressed = await processBytes(new DeflateCompressPipe(), encode('Hello, world!'));
    const decompressed = await processBytes(new DeflateDecompressPipe(), compressed);
    expect(decode(decompressed)).toBe('Hello, world!');
  });

  it('handles empty input for both gzip and deflate', async () => {
    const gzip = await processBytes(new GzipCompressPipe(), []);
    expect([...await processBytes(new GzipDecompressPipe(), gzip)]).toEqual([]);
    const deflate = await processBytes(new DeflateCompressPipe(), []);
    expect([...await processBytes(new DeflateDecompressPipe(), deflate)]).toEqual([]);
  });

  it('round trips arbitrary bytes through gzip', async () => {
    const bytes = [0, 1, 127, 128, 255];
    const compressed = await processBytes(new GzipCompressPipe(), bytes);
    expect([...await processBytes(new GzipDecompressPipe(), compressed)]).toEqual(bytes);
  });

  it('throws PipeError for corrupt gzip data', async () => {
    await expect(processBytes(new GzipDecompressPipe(), [0, 1, 2, 3, 4])).rejects
      .toMatchObject({ message: 'Decompression failed: corrupt or invalid data' });
  });

  it('throws PipeError for corrupt deflate data', async () => {
    await expect(processBytes(new DeflateDecompressPipe(), [0, 1, 2, 3, 4])).rejects
      .toMatchObject({ message: 'Decompression failed: corrupt or invalid data' });
  });

  it('gzip decompressor scores input appropriateness by magic bytes', () => {
    const gzipMagic = new Uint8Array([0x1f, 0x8b, 0, 0]);
    expect(GzipDecompressPipe.getInputAppropriateness(gzipMagic)).toBe(8);
    expect(GzipDecompressPipe.getInputAppropriateness(new Uint8Array([0, 1]))).toBe(0);
    expect(GzipDecompressPipe.getInputAppropriateness(new Uint8Array([0x1f]))).toBe(0);
    expect(GzipDecompressPipe.getInputAppropriateness(null)).toBe(0);
  });
});

describe('Form URL encoding', () => {
  it('exposes expected default configuration', () => {
    expect(new FormUrlencodedEncodePipe().configs.get('encoding').value).toBe('utf-8');
    expect(new FormUrlencodedDecodePipe().configs.get('encoding').value).toBe('utf-8');
  });

  it('encodes spaces as + and special chars as percent-sequences', async () => {
    expect(await processText(new FormUrlencodedEncodePipe(), 'hello world')).toBe('hello+world');
    expect(await processText(new FormUrlencodedEncodePipe(), 'a=b&c=d')).toBe('a%3Db%26c%3Dd');
    expect(await processText(new FormUrlencodedEncodePipe(), 'café')).toBe('caf%C3%A9');
  });

  it('decodes + as space and %XX sequences', async () => {
    expect(await processText(new FormUrlencodedDecodePipe(), 'hello+world')).toBe('hello world');
    expect(await processText(new FormUrlencodedDecodePipe(), 'a%3Db%26c%3Dd')).toBe('a=b&c=d');
    expect(await processText(new FormUrlencodedDecodePipe(), 'caf%C3%A9')).toBe('café');
  });

  it('round trips values containing + and special characters', async () => {
    for (const input of ['hello world', 'a=b', '100% done', 'café']) {
      const encoded = await processText(new FormUrlencodedEncodePipe(), input);
      expect(await processText(new FormUrlencodedDecodePipe(), encoded)).toBe(input);
    }
  });

  it('handles empty input', async () => {
    expect(await processText(new FormUrlencodedEncodePipe(), '')).toBe('');
    expect(await processText(new FormUrlencodedDecodePipe(), '')).toBe('');
  });

  it('throws PipeError for invalid percent sequences', async () => {
    await expect(processText(new FormUrlencodedDecodePipe(), 'bad%ZZ')).rejects
      .toMatchObject({ message: 'Invalid form-urlencoded input' });
  });

  it('scores decode appropriateness correctly', () => {
    expect(FormUrlencodedDecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(FormUrlencodedDecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(FormUrlencodedDecodePipe.getInputAppropriateness(encode('hello+world'))).toBe(10);
    expect(FormUrlencodedDecodePipe.getInputAppropriateness(encode('hello%20world'))).toBe(10);
    expect(FormUrlencodedDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
    expect(FormUrlencodedDecodePipe.getInputAppropriateness(encode('bad%ZZ'))).toBe(-10);
    expect(FormUrlencodedDecodePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('HMAC', () => {
  it('exposes expected default configuration (SHA-256)', () => {
    const pipe = new HmacPipe();
    expect(pipe.configs.get('algorithm').value).toBe('SHA-256');
  });

  it('produces a 32-byte HMAC-SHA-256 digest for known input', async () => {
    const pipe = new HmacPipe();
    const result = await pipe.process(new Map([
      ['input', encode('Hello')],
      ['key', encode('secret')],
    ]));
    const hex = [...result.get('output')].map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe('0cc692f2177b42b6e5cd82488ee6c5d526a007c571e7de1fec07c1e2b1dfa2e2');
  });

  it.each([
    ['SHA-1', 20],
    ['SHA-256', 32],
    ['SHA-384', 48],
    ['SHA-512', 64],
  ])('produces a %s digest of the correct length (%d bytes)', async (algorithm, length) => {
    const pipe = new HmacPipe();
    pipe.setConfig('algorithm', algorithm);
    const result = await pipe.process(new Map([
      ['input', encode('msg')],
      ['key', encode('key')],
    ]));
    expect(result.get('output').length).toBe(length);
  });

  it('uses empty message when input port is not connected', async () => {
    const pipe = new HmacPipe();
    const result = await pipe.process(new Map([['key', encode('k')]]));
    expect(result.get('output').length).toBe(32);
  });

  it('throws PipeError when key is missing', async () => {
    const pipe = new HmacPipe();
    await expect(pipe.process(new Map([['input', encode('msg')]]))).rejects
      .toMatchObject({ message: 'HMAC key is required' });
  });

  it('throws PipeError when key is empty', async () => {
    const pipe = new HmacPipe();
    await expect(pipe.process(new Map([
      ['input', encode('msg')],
      ['key', new Uint8Array(0)],
    ]))).rejects
      .toMatchObject({ message: 'HMAC key is required' });
  });

  it('throws PipeError when Web Crypto is unavailable', async () => {
    const pipe = new HmacPipe();
    const originalCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      await expect(pipe.process(new Map([
        ['input', encode('msg')],
        ['key', encode('key')],
      ]))).rejects.toMatchObject({ message: 'Web Crypto is not supported in this environment' });
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
    }
  });

  it('different keys produce different digests', async () => {
    const pipe = new HmacPipe();
    const r1 = await pipe.process(new Map([['input', encode('msg')], ['key', encode('key1')]]));
    const r2 = await pipe.process(new Map([['input', encode('msg')], ['key', encode('key2')]]));
    expect([...r1.get('output')]).not.toEqual([...r2.get('output')]);
  });
});

describe('MIME Header Decode', () => {
  it('decodes Base64 (B) encoded UTF-8 words', async () => {
    // =?UTF-8?B?SGVsbG8=?= → 'Hello'
    expect(await processText(new MimeHeaderDecodePipe(), '=?UTF-8?B?SGVsbG8=?=')).toBe('Hello');
  });

  it('decodes Q-encoded words with underscores and hex sequences', async () => {
    // =?UTF-8?Q?caf=C3=A9?= → 'café'
    expect(await processText(new MimeHeaderDecodePipe(), '=?UTF-8?Q?caf=C3=A9?=')).toBe('café');
    // =?UTF-8?Q?hello_world?= → 'hello world' (underscore = space)
    expect(await processText(new MimeHeaderDecodePipe(), '=?UTF-8?Q?hello_world?=')).toBe('hello world');
  });

  it('handles case-insensitive encoding specifiers (b and q)', async () => {
    expect(await processText(new MimeHeaderDecodePipe(), '=?UTF-8?b?SGVsbG8=?=')).toBe('Hello');
    expect(await processText(new MimeHeaderDecodePipe(), '=?UTF-8?q?hello_world?=')).toBe('hello world');
  });

  it('passes plain text through unchanged', async () => {
    expect(await processText(new MimeHeaderDecodePipe(), 'plain text no encoding')).toBe('plain text no encoding');
  });

  it('decodes multiple encoded words in one string', async () => {
    const input = '=?UTF-8?B?SGVsbG8=?= =?UTF-8?B?V29ybGQ=?=';
    expect(await processText(new MimeHeaderDecodePipe(), input)).toBe('Hello World');
  });

  it('throws PipeError for malformed B-encoded content', async () => {
    await expect(processText(new MimeHeaderDecodePipe(), '=?UTF-8?B?!!!?=')).rejects
      .toMatchObject({ message: expect.stringContaining('Cannot decode MIME encoded word') });
  });

  it('throws PipeError for malformed Q-encoded content', async () => {
    await expect(processText(new MimeHeaderDecodePipe(), '=?UTF-8?Q?=ZZ?=')).rejects
      .toMatchObject({ message: expect.stringContaining('Cannot decode MIME encoded word') });
  });

  it('throws PipeError for unknown charset', async () => {
    await expect(processText(new MimeHeaderDecodePipe(), '=?not-a-charset?B?SGVsbG8=?=')).rejects
      .toMatchObject({ message: expect.stringContaining('Cannot decode MIME encoded word') });
  });

  it('scores decode appropriateness correctly', () => {
    expect(MimeHeaderDecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(MimeHeaderDecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(MimeHeaderDecodePipe.getInputAppropriateness(encode('=?UTF-8?B?SGVsbG8=?='))).toBe(10);
    expect(MimeHeaderDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
    expect(MimeHeaderDecodePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('SHA Hash', () => {
  it('exposes expected default configuration (SHA-256)', () => {
    expect(new ShaHashPipe().configs.get('algorithm').value).toBe('SHA-256');
  });

  it('produces the correct SHA-256 hash for known inputs', async () => {
    const hex = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

    const empty = await processBytes(new ShaHashPipe(), []);
    expect(hex(empty)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    const hello = await processBytes(new ShaHashPipe(), encode('hello'));
    expect(hex(hello)).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it.each([
    ['SHA-1', 20],
    ['SHA-256', 32],
    ['SHA-384', 48],
    ['SHA-512', 64],
  ])('produces a %s hash of the correct length (%d bytes)', async (algorithm, length) => {
    const pipe = new ShaHashPipe();
    pipe.setConfig('algorithm', algorithm);
    const result = await processBytes(pipe, encode('hello'));
    expect(result.length).toBe(length);
  });

  it('different inputs produce different hashes', async () => {
    const r1 = await processBytes(new ShaHashPipe(), encode('a'));
    const r2 = await processBytes(new ShaHashPipe(), encode('b'));
    expect([...r1]).not.toEqual([...r2]);
  });
});

describe('Unicode Escape encoding', () => {
  it('encodes all characters as \\uXXXX or \\u{...} escape sequences', async () => {
    expect(await processText(new UnicodeEscapeEncodePipe(), 'A')).toBe('\\u0041');
    expect(await processText(new UnicodeEscapeEncodePipe(), 'é')).toBe('\\u00E9');
    expect(await processText(new UnicodeEscapeEncodePipe(), '😀')).toBe('\\u{1F600}');
    expect(await processText(new UnicodeEscapeEncodePipe(), 'A😀')).toBe('\\u0041\\u{1F600}');
  });

  it('decodes \\uXXXX escape sequences', async () => {
    expect(await processText(new UnicodeEscapeDecodePipe(), '\\u0041\\u0042')).toBe('AB');
    expect(await processText(new UnicodeEscapeDecodePipe(), '\\u00E9')).toBe('é');
  });

  it('decodes \\u{...} extended escape sequences', async () => {
    expect(await processText(new UnicodeEscapeDecodePipe(), '\\u{1F600}')).toBe('😀');
    expect(await processText(new UnicodeEscapeDecodePipe(), '\\u{0}')).toBe('\0');
  });

  it('passes non-escape characters through unchanged', async () => {
    expect(await processText(new UnicodeEscapeDecodePipe(), 'hello\\u0020world')).toBe('hello world');
  });

  it('round trips ASCII and non-BMP text', async () => {
    for (const input of ['Hello', 'café', '😀🎉']) {
      const encoded = await processText(new UnicodeEscapeEncodePipe(), input);
      expect(await processText(new UnicodeEscapeDecodePipe(), encoded)).toBe(input);
    }
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeEscapeEncodePipe(), '')).toBe('');
    expect(await processText(new UnicodeEscapeDecodePipe(), '')).toBe('');
  });

  it('throws PipeError for non-UTF-8 input to the encoder', async () => {
    await expect(processBytes(new UnicodeEscapeEncodePipe(), [0xff])).rejects
      .toMatchObject({ message: 'Input is not valid UTF-8' });
  });

  it('throws PipeError for invalid \\u escape (non-hex chars)', async () => {
    await expect(processText(new UnicodeEscapeDecodePipe(), '\\uGGGG')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid Unicode escape') });
  });

  it('throws PipeError for incomplete \\u escape', async () => {
    await expect(processText(new UnicodeEscapeDecodePipe(), '\\u004')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid Unicode escape') });
  });

  it('throws PipeError for unclosed \\u{...} escape', async () => {
    await expect(processText(new UnicodeEscapeDecodePipe(), '\\u{1F600')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid Unicode escape') });
  });

  it('throws PipeError for out-of-range code point in \\u{...}', async () => {
    await expect(processText(new UnicodeEscapeDecodePipe(), '\\u{110000}')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid Unicode escape') });
  });

  it('scores decode appropriateness correctly', () => {
    expect(UnicodeEscapeDecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(UnicodeEscapeDecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(UnicodeEscapeDecodePipe.getInputAppropriateness(encode('\\u0041'))).toBe(8);
    expect(UnicodeEscapeDecodePipe.getInputAppropriateness(encode('\\u{1F600}'))).toBe(8);
    expect(UnicodeEscapeDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
    expect(UnicodeEscapeDecodePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('Unicode Normalize', () => {
  it('exposes expected default configuration (NFC)', () => {
    const pipe = new UnicodeNormalizePipe();
    expect(pipe.configs.get('form').value).toBe('NFC');
  });

  it('NFC composes decomposed characters', async () => {
    const pipe = new UnicodeNormalizePipe();
    // NFD form of 'é': e (U+0065) + combining acute accent (U+0301)
    const decomposed = '\u0065\u0301';
    const result = await processText(pipe, decomposed);
    expect(result).toBe('\u00e9');
    expect(result.length).toBe(1);
  });

  it('NFD decomposes precomposed characters', async () => {
    const pipe = new UnicodeNormalizePipe();
    pipe.setConfig('form', 'NFD');
    const result = await processText(pipe, '\u00e9');
    expect(result.length).toBe(2);
    expect(result.codePointAt(0)).toBe(0x65);
    expect(result.codePointAt(1)).toBe(0x301);
  });

  it('NFKC maps compatibility characters to canonical equivalents', async () => {
    const pipe = new UnicodeNormalizePipe();
    pipe.setConfig('form', 'NFKC');
    // Fullwidth A (U+FF21) → A
    expect(await processText(pipe, '\uFF21')).toBe('A');
    // fi ligature (U+FB01) → fi
    expect(await processText(pipe, '\uFB01')).toBe('fi');
  });

  it('NFKD maps compatibility characters and decomposes', async () => {
    const pipe = new UnicodeNormalizePipe();
    pipe.setConfig('form', 'NFKD');
    expect(await processText(pipe, '\uFB01')).toBe('fi');
  });

  it('leaves already-normalized ASCII text unchanged', async () => {
    const pipe = new UnicodeNormalizePipe();
    expect(await processText(pipe, 'Hello, world!')).toBe('Hello, world!');
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeNormalizePipe(), '')).toBe('');
  });
});
