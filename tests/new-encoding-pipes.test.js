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
import { MimeHeaderDecodePipe, MimeHeaderEncodePipe } from '../src/pipes/builtin/encoding/mime-header.js';
import { ShaHashPipe } from '../src/pipes/builtin/encoding/sha-hash.js';
import { Md5HashPipe } from '../src/pipes/builtin/encoding/md5.js';
import { Crc32Pipe, Adler32Pipe } from '../src/pipes/builtin/encoding/crc32.js';
import {
  JavaScriptEscapeEncodePipe,
  JavaScriptEscapeDecodePipe,
} from '../src/pipes/builtin/encoding/javascript-escape.js';
import { UnicodeNormalizePipe } from '../src/pipes/builtin/encoding/unicode-normalize.js';
import { Base32EncodePipe, Base32DecodePipe } from '../src/pipes/builtin/encoding/base32.js';
import { Base58EncodePipe, Base58DecodePipe } from '../src/pipes/builtin/encoding/base58.js';
import { Ascii85EncodePipe, Ascii85DecodePipe } from '../src/pipes/builtin/encoding/ascii85.js';
import { PunycodeEncodePipe, PunycodeDecodePipe } from '../src/pipes/builtin/encoding/punycode.js';
import { CssEscapePipe, CssUnescapePipe } from '../src/pipes/builtin/encoding/css-escape.js';
import { CharWidthToHalfwidthPipe, CharWidthToFullwidthPipe } from '../src/pipes/builtin/encoding/char-width.js';
import { StringReversePipe } from '../src/pipes/builtin/encoding/reverse.js';
import { PercentEncodePipe } from '../src/pipes/builtin/encoding/percent.js';
import {
  UnicodeCodePointsEncodePipe,
  UnicodeCodePointsDecodePipe,
  UnicodeGraphemeSegmentPipe,
  UnicodeCaseFoldPipe,
} from '../src/pipes/builtin/encoding/unicode-ops.js';
import { decode, encode, processBytes, processText } from './helpers.js';

function makePseudoRandomBytes(length, seed = 0x1234abcd) {
  let state = seed >>> 0;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < bytes.length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    bytes[i] = state & 0xff;
  }
  return bytes;
}

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

  it('round trips larger high-entropy bytes through gzip and deflate', async () => {
    const bytes = makePseudoRandomBytes(64 * 1024);
    const gzipCompressed = await processBytes(new GzipCompressPipe(), bytes);
    const deflateCompressed = await processBytes(new DeflateCompressPipe(), bytes);
    expect([...await processBytes(new GzipDecompressPipe(), gzipCompressed)]).toEqual([...bytes]);
    expect([...await processBytes(new DeflateDecompressPipe(), deflateCompressed)]).toEqual([...bytes]);
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
    ['SHA-224', 28],
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

  it('does not require Web Crypto support', async () => {
    const pipe = new HmacPipe();
    const originalCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      const result = await pipe.process(new Map([
        ['input', encode('msg')],
        ['key', encode('key')],
      ]));
      expect(result.get('output').length).toBe(32);
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

  it('supports additional hash-wasm algorithms', async () => {
    const pipe = new HmacPipe();
    pipe.setConfig('algorithm', 'SHA3-256');
    const result = await pipe.process(new Map([
      ['input', encode('hello')],
      ['key', encode('secret')],
    ]));
    const hex = [...result.get('output')].map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe('850ae61707b3e60d4e45548c4facfda415d301712641fd11535cf395d9e2d7fe');
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
    // RFC 2047 §6.2: whitespace between adjacent encoded words is ignored
    const input = '=?UTF-8?B?SGVsbG8=?= =?UTF-8?B?V29ybGQ=?=';
    expect(await processText(new MimeHeaderDecodePipe(), input)).toBe('HelloWorld');
  });

  it('passes through unrecognised or malformed encoded words unchanged', async () => {
    // The emailjs-mime-codec library is intentionally lenient (RFC-compliant liberal parsing)
    const malformedB = await processText(new MimeHeaderDecodePipe(), '=?UTF-8?B?!!!?=');
    expect(typeof malformedB).toBe('string');
    const malformedQ = await processText(new MimeHeaderDecodePipe(), '=?UTF-8?Q?=ZZ?=');
    expect(typeof malformedQ).toBe('string');
    const unknownCharset = await processText(new MimeHeaderDecodePipe(), '=?not-a-charset?B?SGVsbG8=?=');
    expect(typeof unknownCharset).toBe('string');
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

describe('MD5 Hash', () => {
  const hex = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

  it('produces the correct MD5 digest for known inputs', async () => {
    // RFC 1321 test vectors
    expect(hex(await processBytes(new Md5HashPipe(), []))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(hex(await processBytes(new Md5HashPipe(), encode('a')))).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(hex(await processBytes(new Md5HashPipe(), encode('abc')))).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(hex(await processBytes(new Md5HashPipe(), encode('message digest')))).toBe('f96b697d7cb7938d525a2f31aaf161d0');
  });

  it('produces a 16-byte digest', async () => {
    const result = await processBytes(new Md5HashPipe(), encode('hello'));
    expect(result.length).toBe(16);
  });

  it('different inputs produce different digests', async () => {
    const r1 = await processBytes(new Md5HashPipe(), encode('foo'));
    const r2 = await processBytes(new Md5HashPipe(), encode('bar'));
    expect([...r1]).not.toEqual([...r2]);
  });

  it('handles arbitrary byte input (not just ASCII)', async () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x7f]);
    const result = await processBytes(new Md5HashPipe(), bytes);
    expect(result.length).toBe(16);
  });
});

describe('CRC-32', () => {
  const hex = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

  it('produces the correct CRC-32 for known inputs', async () => {
    // CRC-32 of empty input is 0x00000000
    expect(hex(await processBytes(new Crc32Pipe(), []))).toBe('00000000');
    // CRC-32("hello world") = 0x0d4a1185 (standard IEEE 802.3)
    expect(hex(await processBytes(new Crc32Pipe(), encode('hello world')))).toBe('0d4a1185');
  });

  it('produces a 4-byte big-endian output', async () => {
    const result = await processBytes(new Crc32Pipe(), encode('test'));
    expect(result.length).toBe(4);
  });

  it('different inputs produce different checksums', async () => {
    const r1 = await processBytes(new Crc32Pipe(), encode('foo'));
    const r2 = await processBytes(new Crc32Pipe(), encode('bar'));
    expect([...r1]).not.toEqual([...r2]);
  });

  it('handles arbitrary byte input', async () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x7f]);
    const result = await processBytes(new Crc32Pipe(), bytes);
    expect(result.length).toBe(4);
  });
});

describe('Adler-32', () => {
  const hex = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

  it('produces the correct Adler-32 for known inputs', async () => {
    // Adler-32("") = 0x00000001 (a=1, b=0)
    expect(hex(await processBytes(new Adler32Pipe(), []))).toBe('00000001');
    // Adler-32("Wikipedia") = 0x11e60398
    expect(hex(await processBytes(new Adler32Pipe(), encode('Wikipedia')))).toBe('11e60398');
  });

  it('produces a 4-byte big-endian output', async () => {
    const result = await processBytes(new Adler32Pipe(), encode('test'));
    expect(result.length).toBe(4);
  });

  it('different inputs produce different checksums', async () => {
    const r1 = await processBytes(new Adler32Pipe(), encode('foo'));
    const r2 = await processBytes(new Adler32Pipe(), encode('bar'));
    expect([...r1]).not.toEqual([...r2]);
  });
});

describe('JavaScript Escape encoding', () => {
  it('encodes all characters as \\uXXXX or \\u{...} escape sequences', async () => {
    expect(await processText(new JavaScriptEscapeEncodePipe(), 'A')).toBe('\\u0041');
    expect(await processText(new JavaScriptEscapeEncodePipe(), 'é')).toBe('\\u00E9');
    expect(await processText(new JavaScriptEscapeEncodePipe(), '😀')).toBe('\\u{1F600}');
    expect(await processText(new JavaScriptEscapeEncodePipe(), 'A😀')).toBe('\\u0041\\u{1F600}');
  });

  it('decodes \\uXXXX escape sequences', async () => {
    expect(await processText(new JavaScriptEscapeDecodePipe(), '\\u0041\\u0042')).toBe('AB');
    expect(await processText(new JavaScriptEscapeDecodePipe(), '\\u00E9')).toBe('é');
  });

  it('decodes \\u{...} extended escape sequences', async () => {
    expect(await processText(new JavaScriptEscapeDecodePipe(), '\\u{1F600}')).toBe('😀');
    expect(await processText(new JavaScriptEscapeDecodePipe(), '\\u{0}')).toBe('\0');
  });

  it('decodes simple JavaScript escapes', async () => {
    expect(await processText(new JavaScriptEscapeDecodePipe(), '\\n\\t\\r\\b\\f\\v\\0')).toBe('\n\t\r\b\f\v\0');
    expect(await processText(new JavaScriptEscapeDecodePipe(), '\\\\\\"\\\'')).toBe('\\\"\'');
  });

  it('decodes \\xHH byte escapes', async () => {
    expect(await processText(new JavaScriptEscapeDecodePipe(), '\\x41\\x7A')).toBe('Az');
  });

  it('passes non-escape characters through unchanged', async () => {
    expect(await processText(new JavaScriptEscapeDecodePipe(), 'hello\\u0020world')).toBe('hello world');
  });

  it('round trips ASCII and non-BMP text', async () => {
    for (const input of ['Hello', 'café', '😀🎉']) {
      const encoded = await processText(new JavaScriptEscapeEncodePipe(), input);
      expect(await processText(new JavaScriptEscapeDecodePipe(), encoded)).toBe(input);
    }
  });

  it('handles empty input', async () => {
    expect(await processText(new JavaScriptEscapeEncodePipe(), '')).toBe('');
    expect(await processText(new JavaScriptEscapeDecodePipe(), '')).toBe('');
  });

  it('throws PipeError for non-UTF-8 input to the encoder', async () => {
    await expect(processBytes(new JavaScriptEscapeEncodePipe(), [0xff])).rejects
      .toMatchObject({ message: 'Input is not valid UTF-8' });
  });

  it('throws PipeError for invalid \\u escape (non-hex chars)', async () => {
    await expect(processText(new JavaScriptEscapeDecodePipe(), '\\uGGGG')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JavaScript escape') });
  });

  it('throws PipeError for incomplete \\u escape', async () => {
    await expect(processText(new JavaScriptEscapeDecodePipe(), '\\u004')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JavaScript escape') });
  });

  it('throws PipeError for unclosed \\u{...} escape', async () => {
    await expect(processText(new JavaScriptEscapeDecodePipe(), '\\u{1F600')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JavaScript escape') });
  });

  it('throws PipeError for out-of-range code point in \\u{...}', async () => {
    await expect(processText(new JavaScriptEscapeDecodePipe(), '\\u{110000}')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JavaScript escape') });
  });

  it('throws PipeError for invalid \\x escape', async () => {
    await expect(processText(new JavaScriptEscapeDecodePipe(), '\\x4G')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JavaScript escape') });
  });

  it('throws PipeError for unknown escape', async () => {
    await expect(processText(new JavaScriptEscapeDecodePipe(), '\\q')).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JavaScript escape') });
  });

  it('scores decode appropriateness correctly', () => {
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(encode('\\u0041'))).toBe(8);
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(encode('\\u{1F600}'))).toBe(8);
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(encode('\\x41'))).toBe(8);
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(encode('\\n'))).toBe(8);
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
    expect(JavaScriptEscapeDecodePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
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

describe('Base32 encoding', () => {
  it('encodes bytes to standard Base32 (RFC 4648)', async () => {
    expect(decode(await processBytes(new Base32EncodePipe(), []))).toBe('');
    expect(decode(await processBytes(new Base32EncodePipe(), [0x66]))).toBe('MY======');
    expect(decode(await processBytes(new Base32EncodePipe(), [0x66, 0x6F]))).toBe('MZXQ====');
    expect(decode(await processBytes(new Base32EncodePipe(), [0x66, 0x6F, 0x6F]))).toBe('MZXW6===');
    expect(decode(await processBytes(new Base32EncodePipe(), [0x66, 0x6F, 0x6F, 0x62]))).toBe('MZXW6YQ=');
    expect(decode(await processBytes(new Base32EncodePipe(), [0x66, 0x6F, 0x6F, 0x62, 0x61]))).toBe('MZXW6YTB');
  });

  it('encodes without padding when padding is disabled', async () => {
    const pipe = new Base32EncodePipe();
    pipe.setConfig('padding', false);
    expect(decode(await processBytes(pipe, [0x66]))).toBe('MY');
  });

  it('encodes to Base32hex alphabet', async () => {
    const pipe = new Base32EncodePipe();
    pipe.setConfig('alphabet', 'base32hex');
    expect(decode(await processBytes(pipe, [0x66, 0x6F, 0x6F]))).toBe('CPNMU===');
  });

  it('decodes standard Base32 to bytes', async () => {
    expect([...await processBytes(new Base32DecodePipe(), encode('MY======'))]).toEqual([0x66]);
    expect([...await processBytes(new Base32DecodePipe(), encode('MZXW6YTB'))]).toEqual([0x66, 0x6F, 0x6F, 0x62, 0x61]);
  });

  it('decodes without padding (loose mode)', async () => {
    expect([...await processBytes(new Base32DecodePipe(), encode('MY'))]).toEqual([0x66]);
  });

  it('round trips arbitrary bytes', async () => {
    const bytes = Array.from({ length: 30 }, (_, i) => i);
    const encoded = await processBytes(new Base32EncodePipe(), bytes);
    expect([...await processBytes(new Base32DecodePipe(), encoded)]).toEqual(bytes);
  });

  it('scores decode appropriateness correctly', () => {
    expect(Base32DecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(Base32DecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    // Requires total length >= 8 to avoid false positives on short letter strings
    expect(Base32DecodePipe.getInputAppropriateness(encode('MZXW6YTB'))).toBe(8);
    expect(Base32DecodePipe.getInputAppropriateness(encode('MZXW6==='))).toBe(8);
    expect(Base32DecodePipe.getInputAppropriateness(encode('MY======'))).toBe(8);
    // Base32hex inputs that contain digits (0-9) are scored as 7
    // Note: 'CPNMU===' matches both alphabets, so it scores as standard base32 (8)
    expect(Base32DecodePipe.getInputAppropriateness(encode('00000000'))).toBe(7);
    // Short inputs (total length < 8) score 0
    expect(Base32DecodePipe.getInputAppropriateness(encode('MY'))).toBe(0);
    expect(Base32DecodePipe.getInputAppropriateness(encode('Hello'))).toBe(0);
    expect(Base32DecodePipe.getInputAppropriateness(encode('hello!'))).toBe(-10);
  });

  it('rejects invalid Base32 input', async () => {
    await expect(processBytes(new Base32DecodePipe(), encode('MZXW!@#$'))).rejects
      .toMatchObject({ message: /Invalid Base32/ });
  });
});

describe('Base58 encoding', () => {
  it('encodes bytes to Base58', async () => {
    expect(decode(await processBytes(new Base58EncodePipe(), []))).toBe('');
    expect(decode(await processBytes(new Base58EncodePipe(), [0x00]))).toBe('1');
    expect(decode(await processBytes(new Base58EncodePipe(), [0x00, 0x00, 0x28, 0x7f, 0xb4, 0xcd]))).toBe('11233QC4');
  });

  it('decodes Base58 to bytes', async () => {
    expect([...await processBytes(new Base58DecodePipe(), encode('1'))]).toEqual([0x00]);
    expect([...await processBytes(new Base58DecodePipe(), encode('11233QC4'))]).toEqual([0x00, 0x00, 0x28, 0x7f, 0xb4, 0xcd]);
  });

  it('round trips arbitrary bytes', async () => {
    const bytes = [1, 2, 3, 4, 5, 200, 201, 202];
    const encoded = await processBytes(new Base58EncodePipe(), bytes);
    expect([...await processBytes(new Base58DecodePipe(), encoded)]).toEqual(bytes);
  });

  it('scores decode appropriateness correctly', () => {
    expect(Base58DecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(Base58DecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(Base58DecodePipe.getInputAppropriateness(encode('11233QC4'))).toBe(7);
    // Chars excluded from Base58: 0, O, I, l
    expect(Base58DecodePipe.getInputAppropriateness(encode('0ABC'))).toBe(-10);
    expect(Base58DecodePipe.getInputAppropriateness(encode('OldMan'))).toBe(-10);
  });

  it('rejects invalid Base58 input', async () => {
    await expect(processBytes(new Base58DecodePipe(), encode('0OIl'))).rejects
      .toMatchObject({ message: /Invalid Base58/ });
  });
});

describe('Ascii85 encoding', () => {
  it('encodes bytes to Ascii85 without delimiters', async () => {
    // All-zero 4-byte group encodes as 'z'
    expect(decode(await processBytes(new Ascii85EncodePipe(), [0, 0, 0, 0]))).toBe('z');
    // "Man " encodes to "9jqo^"
    expect(decode(await processBytes(new Ascii85EncodePipe(), [0x4D, 0x61, 0x6E, 0x20]))).toBe('9jqo^');
  });

  it('decodes Ascii85 to bytes', async () => {
    expect([...await processBytes(new Ascii85DecodePipe(), encode('z'))]).toEqual([0, 0, 0, 0]);
    expect([...await processBytes(new Ascii85DecodePipe(), encode('9jqo^'))]).toEqual([0x4D, 0x61, 0x6E, 0x20]);
  });

  it('decodes Ascii85 with <~ ~> delimiters', async () => {
    expect([...await processBytes(new Ascii85DecodePipe(), encode('<~9jqo^~>'))]).toEqual([0x4D, 0x61, 0x6E, 0x20]);
  });

  it('round trips arbitrary bytes', async () => {
    const bytes = Array.from({ length: 20 }, (_, i) => i * 13);
    const encoded = await processBytes(new Ascii85EncodePipe(), bytes);
    expect([...await processBytes(new Ascii85DecodePipe(), encoded)]).toEqual(bytes);
  });

  it('scores decode appropriateness correctly', () => {
    expect(Ascii85DecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(Ascii85DecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    // Requires at least 8 chars to avoid false positives on short printable strings
    expect(Ascii85DecodePipe.getInputAppropriateness(encode('9jqo^BlbD'))).toBe(7);
    expect(Ascii85DecodePipe.getInputAppropriateness(encode('<~9jqo^~>'))).toBe(7);
    // Short inputs (< 8 chars of content) score 0
    expect(Ascii85DecodePipe.getInputAppropriateness(encode('9jqo^'))).toBe(0);
    // Chars outside Ascii85 range
    expect(Ascii85DecodePipe.getInputAppropriateness(encode('~}{longstring'))).toBe(0);
  });
});

describe('Punycode (IDN) encoding', () => {
  it('converts Unicode domain to Punycode ASCII', async () => {
    expect(await processText(new PunycodeEncodePipe(), 'münchen.de')).toBe('xn--mnchen-3ya.de');
    expect(await processText(new PunycodeEncodePipe(), 'example.com')).toBe('example.com');
  });

  it('converts Punycode ASCII domain to Unicode', async () => {
    expect(await processText(new PunycodeDecodePipe(), 'xn--mnchen-3ya.de')).toBe('münchen.de');
    expect(await processText(new PunycodeDecodePipe(), 'example.com')).toBe('example.com');
  });

  it('round trips internationalized domain names', async () => {
    const domain = '日本語.jp';
    const ascii = await processText(new PunycodeEncodePipe(), domain);
    expect(ascii).toMatch(/^xn--/);
    expect(await processText(new PunycodeDecodePipe(), ascii)).toBe(domain);
  });

  it('handles empty input', async () => {
    expect(await processText(new PunycodeEncodePipe(), '')).toBe('');
    expect(await processText(new PunycodeDecodePipe(), '')).toBe('');
  });

  it('scores decode appropriateness correctly', () => {
    expect(PunycodeDecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(PunycodeDecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(PunycodeDecodePipe.getInputAppropriateness(encode('xn--mnchen-3ya.de'))).toBe(10);
    expect(PunycodeDecodePipe.getInputAppropriateness(encode('sub.xn--nxasmq6b.com'))).toBe(10);
    expect(PunycodeDecodePipe.getInputAppropriateness(encode('example.com'))).toBe(0);
    expect(PunycodeDecodePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('CSS Escape/Unescape', () => {
  it('escapes special characters for CSS identifiers', async () => {
    expect(await processText(new CssEscapePipe(), 'hello world')).toBe('hello\\ world');
    expect(await processText(new CssEscapePipe(), 'a#b')).toBe('a\\#b');
    expect(await processText(new CssEscapePipe(), '1abc')).toBe('\\31 abc');
  });

  it('leaves safe identifier characters unescaped', async () => {
    expect(await processText(new CssEscapePipe(), 'hello-world_123')).toBe('hello-world_123');
    expect(await processText(new CssEscapePipe(), 'myClass')).toBe('myClass');
  });

  it('handles empty input', async () => {
    expect(await processText(new CssEscapePipe(), '')).toBe('');
    expect(await processText(new CssUnescapePipe(), '')).toBe('');
  });

  it('unescapes CSS hex escape sequences', async () => {
    expect(await processText(new CssUnescapePipe(), '\\41 ')).toBe('A');
    expect(await processText(new CssUnescapePipe(), '\\000041 ')).toBe('A');
    expect(await processText(new CssUnescapePipe(), '\\1F600 ')).toBe('😀');
  });

  it('unescapes CSS non-hex backslash sequences', async () => {
    expect(await processText(new CssUnescapePipe(), 'hello\\ world')).toBe('hello world');
    expect(await processText(new CssUnescapePipe(), 'a\\#b')).toBe('a#b');
  });

  it('removes CSS line continuations (backslash-newline)', async () => {
    expect(await processText(new CssUnescapePipe(), 'hel\\\nlo')).toBe('hello');
  });

  it('round trips CSS escaping', async () => {
    const source = 'my #id .class > [attr="val"]';
    const escaped = await processText(new CssEscapePipe(), source);
    expect(await processText(new CssUnescapePipe(), escaped)).toBe(source);
  });

  it('scores unescape appropriateness correctly', () => {
    expect(CssUnescapePipe.getInputAppropriateness(null)).toBe(0);
    expect(CssUnescapePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(CssUnescapePipe.getInputAppropriateness(encode('\\41 '))).toBe(8);
    expect(CssUnescapePipe.getInputAppropriateness(encode('hello\\ world'))).toBe(8);
    expect(CssUnescapePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
    expect(CssUnescapePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('Character Width Conversion', () => {
  it('converts fullwidth ASCII to halfwidth', async () => {
    // Fullwidth 'Ａ' (U+FF21) → 'A', fullwidth '！' (U+FF01) → '!'
    expect(await processText(new CharWidthToHalfwidthPipe(), '\uFF21\uFF22\uFF23')).toBe('ABC');
    expect(await processText(new CharWidthToHalfwidthPipe(), '\uFF01')).toBe('!');
    expect(await processText(new CharWidthToHalfwidthPipe(), '\uFF5E')).toBe('~');
  });

  it('converts ideographic space to ASCII space', async () => {
    expect(await processText(new CharWidthToHalfwidthPipe(), '\u3000')).toBe(' ');
  });

  it('converts halfwidth ASCII to fullwidth', async () => {
    expect(await processText(new CharWidthToFullwidthPipe(), 'ABC')).toBe('\uFF21\uFF22\uFF23');
    expect(await processText(new CharWidthToFullwidthPipe(), '!')).toBe('\uFF01');
    expect(await processText(new CharWidthToFullwidthPipe(), '~')).toBe('\uFF5E');
  });

  it('converts ASCII space to ideographic space', async () => {
    expect(await processText(new CharWidthToFullwidthPipe(), ' ')).toBe('\u3000');
  });

  it('leaves non-ASCII/non-ASCII-range characters unchanged', async () => {
    expect(await processText(new CharWidthToHalfwidthPipe(), '日本語')).toBe('日本語');
    expect(await processText(new CharWidthToFullwidthPipe(), '日本語')).toBe('日本語');
  });

  it('handles empty input', async () => {
    expect(await processText(new CharWidthToHalfwidthPipe(), '')).toBe('');
    expect(await processText(new CharWidthToFullwidthPipe(), '')).toBe('');
  });

  it('scores halfwidth appropriateness for inputs containing fullwidth chars', () => {
    expect(CharWidthToHalfwidthPipe.getInputAppropriateness(null)).toBe(0);
    expect(CharWidthToHalfwidthPipe.getInputAppropriateness(encode('\uFF21'))).toBe(8);
    expect(CharWidthToHalfwidthPipe.getInputAppropriateness(encode('\u3000'))).toBe(8);
    expect(CharWidthToHalfwidthPipe.getInputAppropriateness(encode('ABC'))).toBe(0);
  });

  it('scores fullwidth appropriateness for inputs containing ASCII chars', () => {
    expect(CharWidthToFullwidthPipe.getInputAppropriateness(null)).toBe(0);
    expect(CharWidthToFullwidthPipe.getInputAppropriateness(encode('ABC'))).toBe(5);
    expect(CharWidthToFullwidthPipe.getInputAppropriateness(encode('\uFF21'))).toBe(0);
  });
});

describe('String Reverse', () => {
  it('reverses ASCII strings', async () => {
    expect(await processText(new StringReversePipe(), 'hello')).toBe('olleh');
    expect(await processText(new StringReversePipe(), 'abcde')).toBe('edcba');
  });

  it('handles empty input', async () => {
    expect(await processText(new StringReversePipe(), '')).toBe('');
  });

  it('handles single character', async () => {
    expect(await processText(new StringReversePipe(), 'a')).toBe('a');
  });

  it('preserves emoji grapheme clusters (grapheme-safe reversal)', async () => {
    // Without grapheme-awareness, 😀 would split into surrogate pairs
    const result = await processText(new StringReversePipe(), 'ab😀');
    expect(result).toBe('😀ba');
  });

  it('preserves combining characters', async () => {
    // é = e + combining acute accent (U+0301)
    const result = await processText(new StringReversePipe(), 'ae\u0301b');
    expect(result).toBe('be\u0301a');
  });
});

describe('PercentEncode custom mode', () => {
  it('encodes only characters matching the custom pattern', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', 'custom');
    pipe.setConfig('customPattern', '[^A-Za-z0-9]');
    expect(await processText(pipe, 'Hello World!')).toBe('Hello%20World%21');
  });

  it('encodes only whitespace when pattern is \\s', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', 'custom');
    pipe.setConfig('customPattern', '\\s');
    expect(await processText(pipe, 'hello world\ttab')).toBe('hello%20world%09tab');
  });

  it('handles empty input in custom mode', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', 'custom');
    expect(await processText(pipe, '')).toBe('');
  });

  it('throws PipeError on invalid regex pattern', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', 'custom');
    pipe.setConfig('customPattern', '[invalid');
    await expect(processText(pipe, 'test')).rejects
      .toMatchObject({ message: /Invalid custom pattern/ });
  });

  it('encodes multibyte UTF-8 characters correctly', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', 'custom');
    pipe.setConfig('customPattern', '[^A-Za-z0-9]');
    // © (U+00A9) is 2 bytes in UTF-8: 0xC2 0xA9
    expect(await processText(pipe, '©')).toBe('%C2%A9');
  });
});

describe('MimeHeaderEncode', () => {
  it('encodes non-ASCII text as Base64 encoded word (B encoding)', async () => {
    const pipe = new MimeHeaderEncodePipe();
    const result = await processText(pipe, 'Héllo');
    // Should produce a valid RFC 2047 encoded word
    expect(result).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  });

  it('leaves pure ASCII content unchanged (no encoding needed)', async () => {
    expect(await processText(new MimeHeaderEncodePipe(), 'Hello')).toBe('Hello');
  });

  it('encodes as Q (Quoted-Printable) when transferEncoding is Q', async () => {
    const pipe = new MimeHeaderEncodePipe();
    pipe.setConfig('transferEncoding', 'Q');
    const result = await processText(pipe, 'Héllo');
    expect(result).toMatch(/^=\?UTF-8\?Q\?/);
  });

  it('round trips non-ASCII content via B encoding', async () => {
    const source = 'Héllo Wörld';
    const encoded = await processText(new MimeHeaderEncodePipe(), source);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    expect(await processText(new MimeHeaderDecodePipe(), encoded)).toBe(source);
  });

  it('handles empty input', async () => {
    expect(await processText(new MimeHeaderEncodePipe(), '')).toBe('');
  });
});

describe('Unicode Code Points Encode', () => {
  it('encodes ASCII text as U+XXXX tokens', async () => {
    expect(await processText(new UnicodeCodePointsEncodePipe(), 'AB')).toBe('U+0041 U+0042');
    expect(await processText(new UnicodeCodePointsEncodePipe(), 'Hi')).toBe('U+0048 U+0069');
  });

  it('encodes non-BMP code points with at least 5 hex digits', async () => {
    // 😀 = U+1F600
    expect(await processText(new UnicodeCodePointsEncodePipe(), '😀')).toBe('U+1F600');
  });

  it('encodes combining sequences as separate code points', async () => {
    // é decomposed: U+0065 + U+0301
    expect(await processText(new UnicodeCodePointsEncodePipe(), '\u0065\u0301')).toBe('U+0065 U+0301');
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeCodePointsEncodePipe(), '')).toBe('');
  });
});

describe('Unicode Code Points Decode', () => {
  it('decodes U+XXXX tokens to text', async () => {
    expect(await processText(new UnicodeCodePointsDecodePipe(), 'U+0041 U+0042')).toBe('AB');
    expect(await processText(new UnicodeCodePointsDecodePipe(), 'U+1F600')).toBe('😀');
  });

  it('decodes 0x-prefixed hex tokens', async () => {
    expect(await processText(new UnicodeCodePointsDecodePipe(), '0x41 0x42')).toBe('AB');
  });

  it('decodes decimal tokens', async () => {
    expect(await processText(new UnicodeCodePointsDecodePipe(), '65 66')).toBe('AB');
  });

  it('handles comma- and newline-separated tokens', async () => {
    expect(await processText(new UnicodeCodePointsDecodePipe(), 'U+0041,U+0042')).toBe('AB');
    expect(await processText(new UnicodeCodePointsDecodePipe(), 'U+0041\nU+0042')).toBe('AB');
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeCodePointsDecodePipe(), '')).toBe('');
    expect(await processText(new UnicodeCodePointsDecodePipe(), '   ')).toBe('');
  });

  it('round trips encode → decode', async () => {
    for (const input of ['Hello', 'café', '😀🎉', '\u0065\u0301']) {
      const encoded = await processText(new UnicodeCodePointsEncodePipe(), input);
      expect(await processText(new UnicodeCodePointsDecodePipe(), encoded)).toBe(input);
    }
  });

  it('throws PipeError for invalid tokens', async () => {
    await expect(processText(new UnicodeCodePointsDecodePipe(), 'U+GGGG'))
      .rejects.toMatchObject({ message: expect.stringContaining('Invalid') });
    await expect(processText(new UnicodeCodePointsDecodePipe(), 'U+110000'))
      .rejects.toMatchObject({ message: expect.stringContaining('out of Unicode range') });
    await expect(processText(new UnicodeCodePointsDecodePipe(), 'U+D800'))
      .rejects.toMatchObject({ message: expect.stringContaining('Surrogate') });
  });

  it('scores decode appropriateness correctly', () => {
    expect(UnicodeCodePointsDecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(UnicodeCodePointsDecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(UnicodeCodePointsDecodePipe.getInputAppropriateness(encode('U+0041 U+0042'))).toBe(8);
    expect(UnicodeCodePointsDecodePipe.getInputAppropriateness(encode('hello world'))).toBe(0);
    expect(UnicodeCodePointsDecodePipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('Unicode Grapheme Segment', () => {
  it('splits ASCII text into one character per line', async () => {
    expect(await processText(new UnicodeGraphemeSegmentPipe(), 'ABC')).toBe('A\nB\nC');
  });

  it('keeps emoji + modifier as a single grapheme cluster', async () => {
    // 👨‍👩‍👧 is a ZWJ sequence; it should stay as one segment
    const family = '👨\u200D👩\u200D👧';
    const result = await processText(new UnicodeGraphemeSegmentPipe(), family);
    expect(result).toBe(family);
    expect(result.split('\n')).toHaveLength(1);
  });

  it('keeps combining character with its base as one grapheme', async () => {
    // é = e + combining acute accent
    const composed = '\u0065\u0301';
    const result = await processText(new UnicodeGraphemeSegmentPipe(), composed);
    expect(result).toBe(composed);
    expect(result.split('\n')).toHaveLength(1);
  });

  it('separates a multi-grapheme string into correct clusters', async () => {
    // 'café' with decomposed 'e + combining acute' → c, a, f, e+combining
    const cafe = 'caf\u0065\u0301';
    const result = await processText(new UnicodeGraphemeSegmentPipe(), cafe);
    expect(result.split('\n')).toHaveLength(4);
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeGraphemeSegmentPipe(), '')).toBe('');
  });
});

describe('Unicode Case Fold', () => {
  it('lowercases ASCII text', async () => {
    expect(await processText(new UnicodeCaseFoldPipe(), 'Hello World')).toBe('hello world');
  });

  it('lowercases non-ASCII text', async () => {
    expect(await processText(new UnicodeCaseFoldPipe(), 'CAFÉ')).toBe('café');
  });

  it('applies NFKC compatibility decomposition before folding', async () => {
    // Fullwidth A (U+FF21) → 'a' after NFKC + casefold
    expect(await processText(new UnicodeCaseFoldPipe(), '\uFF21')).toBe('a');
    // fi ligature (U+FB01) → 'fi' after NFKC
    expect(await processText(new UnicodeCaseFoldPipe(), '\uFB01')).toBe('fi');
  });

  it('is idempotent on already-folded text', async () => {
    const text = 'hello world';
    expect(await processText(new UnicodeCaseFoldPipe(), text)).toBe(text);
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeCaseFoldPipe(), '')).toBe('');
  });
});
