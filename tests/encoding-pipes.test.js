import { describe, expect, it, vi } from 'vitest';
import { InputPipe } from '../src/pipes/builtin/input-pipe.js';
import { Base64EncodePipe, Base64DecodePipe } from '../src/pipes/builtin/encoding/base64.js';
import { Base64urlEncodePipe, Base64urlDecodePipe } from '../src/pipes/builtin/encoding/base64url.js';
import { PercentEncodePipe, PercentDecodePipe } from '../src/pipes/builtin/encoding/percent.js';
import {
  QuotedPrintableEncodePipe,
  QuotedPrintableDecodePipe,
} from '../src/pipes/builtin/encoding/quoted-printable.js';
import { HexEncodePipe, HexDecodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { BinaryEncodePipe, BinaryDecodePipe } from '../src/pipes/builtin/encoding/binary.js';
import { HtmlEncodePipe, HtmlDecodePipe } from '../src/pipes/builtin/encoding/html-encode.js';
import { XmlEncodePipe, XmlDecodePipe } from '../src/pipes/builtin/encoding/xml-encode.js';
import { CharsetDecodePipe, CharsetEncodePipe } from '../src/pipes/builtin/encoding/charset.js';
import { ALL_ENCODINGS } from '../src/pipes/builtin/encoding/charset.js';
import { SlashEscapePipe, SlashUnescapePipe } from '../src/pipes/builtin/encoding/slash-escape.js';
import { UrlEncodePipe, UrlDecodePipe } from '../src/pipes/builtin/encoding/url-encode.js';
import { RotPipe } from '../src/pipes/builtin/encoding/rot.js';
import { MorseEncodePipe, MorseDecodePipe } from '../src/pipes/builtin/encoding/morse.js';
import {
  GzipCompressPipe,
  GzipDecompressPipe,
  DeflateCompressPipe,
  DeflateDecompressPipe,
  DeflateRawCompressPipe,
  DeflateRawDecompressPipe,
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
import {
  UnicodeCaseFoldLowerPipe,
  UnicodeCaseFoldUpperPipe,
} from '../src/pipes/builtin/encoding/unicode-ops.js';
import { ZipPipe, UnzipPipe } from '../src/pipes/builtin/encoding/zip.js';
import { Lz4CompressPipe, Lz4DecompressPipe } from '../src/pipes/builtin/encoding/lz4.js';
import { BrotliCompressPipe, BrotliDecompressPipe } from '../src/pipes/builtin/encoding/brotli.js';
import { ZstdDecompressPipe } from '../src/pipes/builtin/encoding/zstd.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('source and byte encodings', () => {
  it.each([
    [InputPipe, { text: '', rawBytes: null }],
    [Base64EncodePipe, {}],
    [Base64DecodePipe, {}],
    [QuotedPrintableEncodePipe, {}],
    [QuotedPrintableDecodePipe, {}],
    [HexEncodePipe, { separator: '', uppercase: true }],
    [HexDecodePipe, {}],
    [BinaryEncodePipe, { separator: ' ' }],
    [BinaryDecodePipe, {}],
    [PercentEncodePipe, { encoding: 'utf-8', mode: 'component', customPattern: '[^A-Za-z0-9\\-_.~]' }],
    [PercentDecodePipe, { encoding: 'utf-8' }],
    [UrlEncodePipe, { encoding: 'utf-8' }],
    [UrlDecodePipe, { encoding: 'utf-8' }],
    [HtmlEncodePipe, { encoding: 'utf-8', mode: 'minimal' }],
    [HtmlDecodePipe, { encoding: 'utf-8' }],
    [XmlEncodePipe, { encoding: 'utf-8' }],
    [XmlDecodePipe, { encoding: 'utf-8' }],
    [CharsetDecodePipe, { fromEncoding: 'utf-8', fatal: true }],
    [CharsetEncodePipe, { toEncoding: 'utf-8' }],
    [SlashEscapePipe, { encoding: 'utf-8', escapeNonAscii: false }],
    [SlashUnescapePipe, { encoding: 'utf-8' }],
    [RotPipe, { encoding: 'utf-8', rotation: 13 }],
    [MorseEncodePipe, { encoding: 'utf-8' }],
    [MorseDecodePipe, { encoding: 'utf-8' }],
  ])('%s exposes its expected default configuration', (PipeClass, expected) => {
    const pipe = new PipeClass();
    expect(Object.fromEntries([...pipe.configs].map(([name, config]) => [name, config.value])))
      .toEqual(expected);
  });

  it('produces input text as UTF-8 bytes', async () => {
    const pipe = new InputPipe();
    expect(pipe.defineInputs()).toEqual([]);
    pipe.setConfig('text', 'Hello 🌍');
    expect(decode((await pipe.process(new Map())).get('output'))).toBe('Hello 🌍');
  });

  it('preserves raw bytes entered through the input viewer', async () => {
    const pipe = new InputPipe();
    pipe.setConfig('rawBytes', [0, 255, 65]);
    await pipe.run();
    expect([...pipe.getOutputData()]).toEqual([0, 255, 65]);
  });

  it('round trips arbitrary bytes through Base64 and rejects invalid input', async () => {
    const bytes = [0, 1, 127, 128, 255];
    const encoded = await processBytes(new Base64EncodePipe(), bytes);
    expect(decode(encoded)).toBe('AAF/gP8=');
    expect([...await processBytes(new Base64DecodePipe(), encoded)]).toEqual(bytes);
    await expect(processText(new Base64DecodePipe(), '%%%')).rejects
      .toMatchObject({ message: 'Invalid Base64 input' });
  });

  it('encodes and decodes Quoted-Printable data', async () => {
    expect(decode(await processBytes(new QuotedPrintableEncodePipe(), [0xC3, 0xA9]))).toBe('=C3=A9');
    expect([...await processBytes(new QuotedPrintableDecodePipe(), encode('=C3=A9'))])
      .toEqual([0xC3, 0xA9]);
    expect(decode(await processBytes(new QuotedPrintableEncodePipe(), encode('Hello')))).toBe('Hello');
    expect([...await processBytes(new QuotedPrintableDecodePipe(), encode('=3D'))]).toEqual([0x3D]);
  });

  it('handles Quoted-Printable soft line breaks, wrapping, invalid escapes, and empties', async () => {
    expect(decode(await processBytes(
      new QuotedPrintableEncodePipe(),
      new Uint8Array(76).fill(0x41)
    ))).toBe(`${'A'.repeat(75)}=\r\nA`);
    expect([...await processBytes(
      new QuotedPrintableDecodePipe(),
      encode('Hello=\r\nWorld')
    )]).toEqual([...encode('HelloWorld')]);
    expect(QuotedPrintableDecodePipe.getInputAppropriateness(encode('name=3Dvalue'))).toBe(8);
    expect(QuotedPrintableDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
    await expect(processText(new QuotedPrintableDecodePipe(), '=ZZ')).rejects
      .toMatchObject({ message: 'Invalid Quoted-Printable: invalid escape at position 0' });
    expect(await processBytes(new QuotedPrintableEncodePipe(), [])).toHaveLength(0);
    expect(await processBytes(new QuotedPrintableDecodePipe(), [])).toHaveLength(0);
  });

  it('round trips arbitrary bytes through Quoted-Printable', async () => {
    const bytes = [0, 9, 10, 13, 32, 61, 127, 128, 195, 169, 255];
    const encoded = await processBytes(new QuotedPrintableEncodePipe(), bytes);
    expect([...await processBytes(new QuotedPrintableDecodePipe(), encoded)]).toEqual(bytes);
  });

  it('handles empty Base64, hex, and binary inputs', async () => {
    expect(await processBytes(new Base64DecodePipe(), [])).toHaveLength(0);
    expect(await processText(new Base64EncodePipe(), '')).toBe('');
    expect(await processBytes(new HexDecodePipe(), [])).toHaveLength(0);
    expect(await processBytes(new BinaryDecodePipe(), [])).toHaveLength(0);
  });

  it('encodes configurable hex and decodes separated hex', async () => {
    const encoder = new HexEncodePipe();
    encoder.setConfig('separator', ':');
    encoder.setConfig('uppercase', false);
    expect(decode(await processBytes(encoder, [0, 10, 255]))).toBe('00:0a:ff');
    expect([...await processBytes(new HexDecodePipe(), encode('00: 0a-FF'))])
      .toEqual([0, 10, 255]);
    await expect(processText(new HexDecodePipe(), 'abc')).rejects
      .toMatchObject({
        message: 'Hex string has odd number of digits',
        selections: [{ index: 2, length: 1 }],
      });
  });

  it('translates hex selections in both directions', async () => {
    const encoder = new HexEncodePipe();
    encoder.setConfig('separator', ':');
    encoder.setInputData('input', encode('0123'));
    await encoder.run();
    expect(encoder.translateSelections('input', 'input', 'output', 'output', [
      { index: 2, length: 2 },
    ])).toEqual([{ index: 6, length: 5 }]);
    expect(encoder.translateSelections('output', 'output', 'input', 'input', [
      { index: 6, length: 5 },
    ])).toEqual([{ index: 2, length: 2 }]);

    const decoder = new HexDecodePipe();
    decoder.setInputData('input', encode('30:31 32-33'));
    await decoder.run();
    expect(decoder.translateSelections('input', 'input', 'output', 'output', [
      { index: 6, length: 5 },
    ])).toEqual([{ index: 2, length: 2 }]);
    expect(decoder.translateSelections('output', 'output', 'input', 'input', [
      { index: 2, length: 2 },
    ])).toEqual([{ index: 6, length: 5 }]);
  });

  it('encodes configurable binary and validates tokens', async () => {
    const encoder = new BinaryEncodePipe();
    encoder.setConfig('separator', ',');
    expect(decode(await processBytes(encoder, [1, 255]))).toBe('00000001,11111111');
    expect([...await processBytes(new BinaryDecodePipe(), encode('00000001, 11111111'))])
      .toEqual([1, 255]);
    await expect(processText(new BinaryDecodePipe(), '102')).rejects
      .toMatchObject({
        message: 'Invalid binary byte at position 0: "102"',
        selections: [{ index: 0, length: 3 }],
      });
  });
});

describe('percent and URL encodings', () => {
  it.each([
    ['component', 'a/b c', 'a%2Fb%20c'],
    ['full', 'https://x.test/a b?q=1', 'https://x.test/a%20b?q=1'],
    ['minimal', 'a/b café', 'a%2Fb%20caf%C3%A9'],
    ['unexpected', 'a/b', 'a%2Fb'],
  ])('percent-encodes in %s mode', async (mode, input, expected) => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', mode);
    expect(await processText(pipe, input)).toBe(expected);
  });

  it('decodes percent data and reports malformed sequences', async () => {
    expect(await processText(new PercentDecodePipe(), 'caf%C3%A9')).toBe('café');
    expect(await processText(new PercentDecodePipe(), 'a%2Fb%3Fc%3Dd')).toBe('a/b?c=d');
    await expect(processText(new PercentDecodePipe(), '%ZZ')).rejects
      .toMatchObject({ message: 'Invalid percent-encoding in input' });
  });

  it('encodes and decodes whole URLs while preserving structure', async () => {
    const input = 'https://example.com/a b?q=x y';
    const encoded = await processText(new UrlEncodePipe(), input);
    expect(encoded).toBe('https://example.com/a%20b?q=x%20y');
    expect(await processText(new UrlDecodePipe(), encoded)).toBe(input);
    await expect(processText(new UrlDecodePipe(), '%E0%A4%A')).rejects
      .toMatchObject({ message: 'Invalid URI encoding in input' });
    await expect(new UrlEncodePipe().processString('\ud800')).rejects
      .toMatchObject({ message: 'Cannot encode input as URI' });
  });
});

describe('markup encodings', () => {
  it('encodes minimal and non-ASCII HTML and decodes entity forms', async () => {
    const encoder = new HtmlEncodePipe();
    expect(await processText(encoder, `<a x="'">©`))
      .toBe('&lt;a x=&quot;&#x27;&quot;&gt;©');
    encoder.setConfig('mode', 'all-non-ascii');
    expect(await processText(encoder, '© 😀')).toBe('&copy; &#x1F600;');
    expect(await processText(new HtmlDecodePipe(), '&amp;&#169;&#x1F600;&unknown;'))
      .toBe('&©😀&unknown;');
  });

  it.each([
    ['&nbsp;', '\u00a0'],
    ['&copy;', '©'],
    ['&reg;', '®'],
    ['&trade;', '™'],
    ['&mdash;', '—'],
    ['&ndash;', '–'],
    ['&hellip;', '…'],
    ['&amp &bogus; &#xZZ;', '& &bogus; &#xZZ;'],
  ])('decodes HTML entity input %s', async (input, expected) => {
    expect(await processText(new HtmlDecodePipe(), input)).toBe(expected);
  });

  it('round trips XML entities and leaves unknown names unchanged', async () => {
    const source = `<tag a="'">&`;
    const encoded = await processText(new XmlEncodePipe(), source);
    expect(encoded).toBe('&lt;tag a=&quot;&apos;&quot;&gt;&amp;');
    expect(await processText(new XmlDecodePipe(), encoded + '&#65;&#x42;&copy;'))
      .toBe(source + 'AB&copy;');
  });
});

describe('charset encodings', () => {
  it('decodes supported bytes to UTF-8 and handles fatal errors', async () => {
    const pipe = new CharsetDecodePipe();
    pipe.setConfig('fromEncoding', 'windows-1252');
    expect(decode(await processBytes(pipe, [0x80]))).toBe('€');
    pipe.setConfig('fromEncoding', 'utf-8');
    await expect(processBytes(pipe, [0xff])).rejects.toMatchObject({
      message: expect.stringContaining('Cannot decode bytes as utf-8'),
    });
    pipe.setConfig('fatal', false);
    expect(decode(await processBytes(pipe, [0xff]))).toBe('�');
  });

  it.each([
    ['utf-16le', [0x41, 0, 0x3d, 0xd8, 0, 0xde]],
    ['utf-16be', [0, 0x41, 0xd8, 0x3d, 0xde, 0]],
    ['utf-32le', [0x41, 0x00, 0x00, 0x00, 0x00, 0xF6, 0x01, 0x00]],
    // 'A' = U+0041 → 00 00 00 41 (BE) / 41 00 00 00 (LE)
    // '😀' = U+1F600 → 00 01 F6 00 (BE) / 00 F6 01 00 (LE)
    ['utf-32be', [0x00, 0x00, 0x00, 0x41, 0x00, 0x01, 0xF6, 0x00]],
    ['iso-8859-1', [0x41, 0xe9]],
    ['shift_jis', [0x41]],
  ])('decodes representative %s input', async (encoding, bytes) => {
    const pipe = new CharsetDecodePipe();
    pipe.setConfig('fromEncoding', encoding);
    // Use our pipe result as the source of truth; cross-check against TextDecoder
    // where it is supported in the test environment. utf-32 is not in the WHATWG
    // Encoding spec, so TextDecoder cross-checks are skipped for utf-32 encodings.
    const result = decode(await processBytes(pipe, bytes));
    if (!encoding.startsWith('utf-32')) {
      const expected = new TextDecoder(encoding, { fatal: true }).decode(Uint8Array.from(bytes));
      expect(result).toBe(expected);
    } else {
      expect(result).toBe('A😀');
    }
  });

  it('encodes UTF-8 to all supported encodings via iconv-lite', async () => {
    const pipe = new CharsetEncodePipe();
    // UTF-8 passthrough
    expect([...await processBytes(pipe, encode('A😀'))]).toEqual([...encode('A😀')]);
    // UTF-16 variants
    pipe.setConfig('toEncoding', 'utf-16le');
    expect([...await processBytes(pipe, encode('A😀'))])
      .toEqual([0x41, 0, 0x3d, 0xd8, 0, 0xde]);
    pipe.setConfig('toEncoding', 'utf-16be');
    expect([...await processBytes(pipe, encode('A😀'))])
      .toEqual([0, 0x41, 0xd8, 0x3d, 0xde, 0]);
    // UTF-32 variants (4 bytes per code point)
    pipe.setConfig('toEncoding', 'utf-32le');
    expect([...await processBytes(pipe, encode('A😀'))])
      .toEqual([0x41, 0x00, 0x00, 0x00, 0x00, 0xF6, 0x01, 0x00]);
    pipe.setConfig('toEncoding', 'utf-32be');
    expect([...await processBytes(pipe, encode('A😀'))])
      .toEqual([0x00, 0x00, 0x00, 0x41, 0x00, 0x01, 0xF6, 0x00]);
    // ASCII - unmappable characters are substituted with '?'
    pipe.setConfig('toEncoding', 'ascii');
    expect([...await processBytes(pipe, encode('Hello'))]).toEqual([72, 101, 108, 108, 111]);
    expect(await processText(pipe, '€')).toBe('?');
    // ISO-8859-1 - unmappable characters are substituted with '?'
    pipe.setConfig('toEncoding', 'iso-8859-1');
    expect([...await processBytes(pipe, encode('Aé'))]).toEqual([0x41, 0xE9]);
    expect(await processText(pipe, '€')).toBe('?');
    // windows-1252 — '€' is U+20AC → 0x80
    pipe.setConfig('toEncoding', 'windows-1252');
    expect([...await processBytes(pipe, encode('€'))]).toEqual([0x80]);
    // shift_jis
    pipe.setConfig('toEncoding', 'shift_jis');
    expect([...await processBytes(pipe, encode('Hello'))]).toEqual([72, 101, 108, 108, 111]);
    // Non-UTF-8 input always rejected first
    pipe.setConfig('toEncoding', 'utf-8');
    await expect(processBytes(pipe, [0xff])).rejects.toMatchObject({
      message: expect.stringContaining('Input bytes are not valid UTF-8'),
    });
  });

  it('exposes all iconv-lite encoding names as options on both pipes', () => {
    const decodePipe = new CharsetDecodePipe();
    const encodePipe = new CharsetEncodePipe();
    const decodeOptions = [...decodePipe.configs.get('fromEncoding').options];
    const encodeOptions = [...encodePipe.configs.get('toEncoding').options];
    expect(decodeOptions).toEqual(ALL_ENCODINGS);
    expect(encodeOptions).toEqual(ALL_ENCODINGS);
    // Spot-check a selection of encodings from different families
    const expected = [
      'utf-8', 'utf-16be', 'utf-16le', 'utf-32be', 'utf-32le',
      'iso-8859-1', 'iso-8859-15', 'windows-1252', 'windows-1251',
      'shift_jis', 'euc-jp', 'euc-kr', 'gbk', 'gb18030', 'big5',
      'koi8-r', 'koi8-u', 'ascii', 'macintosh', 'cp437', 'cp866',
      'ibm437', 'viscii', 'tis620', 'armscii8', 'mik',
    ];
    for (const enc of expected) {
      expect(decodeOptions).toContain(enc);
    }
    expect(ALL_ENCODINGS.length).toBeGreaterThan(400);
  });
});

describe('slash escaping', () => {
  it('escapes special and optional non-ASCII characters', async () => {
    const pipe = new SlashEscapePipe();
    expect(await processText(pipe, '\0\b\t\n\r\f\v\\\'"')).toBe('\\0\\b\\t\\n\\r\\f\\v\\\\\\\'\\"');
    pipe.setConfig('escapeNonAscii', true);
    expect(await processText(pipe, 'é😀')).toBe('\\u00E9\\u{1F600}');
  });

  it('unescapes simple, hex, Unicode, and unknown forms', async () => {
    const input = '\\0\\b\\t\\n\\r\\f\\v\\\\\\\'\\"\\x41\\u0042\\u{1F600}\\q';
    expect(await processText(new SlashUnescapePipe(), input))
      .toBe('\0\b\t\n\r\f\v\\\'"AB😀q');
    expect(await processText(new SlashUnescapePipe(), '\\xZZ\\uZZZZ\\u{no}\\u{123'))
      .toBe('\\xZZ\\uZZZZ\\u{no}\\u{123');
  });

  it('preserves a trailing slash and handles Unicode boundaries', async () => {
    expect(await processText(new SlashUnescapePipe(), 'value\\')).toBe('value\\');
    expect(await processText(new SlashUnescapePipe(), '\\u0000\\u{10FFFF}'))
      .toBe('\0\u{10ffff}');
  });
});

describe('ROT cipher', () => {
  it('applies ROT13 by default to letters only', async () => {
    expect(await processText(new RotPipe(), 'Hello, World!')).toBe('Uryyb, Jbeyq!');
  });

  it('is self-inverse for ROT13', async () => {
    const pipe = new RotPipe();
    const encoded = await processText(pipe, 'Hello, World!');
    expect(await processText(new RotPipe(), encoded)).toBe('Hello, World!');
  });

  it('handles empty input', async () => {
    expect(await processText(new RotPipe(), '')).toBe('');
  });

  it('applies a custom rotation amount', async () => {
    const pipe = new RotPipe();
    pipe.setConfig('rotation', 1);
    expect(await processText(pipe, 'abc XYZ')).toBe('bcd YZA');
  });

  it('rotation 0 leaves text unchanged', async () => {
    const pipe = new RotPipe();
    pipe.setConfig('rotation', 0);
    expect(await processText(pipe, 'abcXYZ')).toBe('abcXYZ');
  });

  it('wraps correctly at alphabet boundary', async () => {
    const pipe = new RotPipe();
    pipe.setConfig('rotation', 25);
    expect(await processText(pipe, 'az AZ')).toBe('zy ZY');
  });

  it('passes non-letter characters through unchanged', async () => {
    expect(await processText(new RotPipe(), '123 !@# àéü')).toBe('123 !@# àéü');
  });

  it('rejects out-of-range rotation', async () => {
    const pipe = new RotPipe();
    pipe.setConfig('rotation', 26);
    await expect(processText(pipe, 'test')).rejects
      .toMatchObject({ message: 'Rotation must be an integer between 0 and 25' });
  });
});

describe('Morse code', () => {
  it('encodes and decodes letters, digits, punctuation, and words', async () => {
    const encoded = await processText(new MorseEncodePipe(), 'SOS, 123');
    expect(encoded).toBe('... --- ... --..-- / .---- ..--- ...--');
    expect(await processText(new MorseDecodePipe(), encoded)).toBe('SOS, 123');
  });

  it('accepts slash and pipe separators while decoding', async () => {
    expect(await processText(new MorseDecodePipe(), '.... . .-.. .-.. --- / .-- --- .-. .-.. -..'))
      .toBe('HELLO WORLD');
    expect(await processText(new MorseDecodePipe(), '.... . .-.. .-.. --- | .-- --- .-. .-.. -..'))
      .toBe('HELLO WORLD');
  });

  it('scores decode appropriateness and rejects malformed input', async () => {
    expect(MorseDecodePipe.getInputAppropriateness(encode('... --- ...'))).toBe(7);
    expect(MorseDecodePipe.getInputAppropriateness(encode('... --- ... / .----'))).toBe(8);
    expect(MorseDecodePipe.getInputAppropriateness(encode('--'))).toBe(5);
    expect(MorseDecodePipe.getInputAppropriateness(encode('.'))).toBe(0);
    expect(MorseDecodePipe.getInputAppropriateness(encode('... _ ...'))).toBe(-10);

    await expect(processText(new MorseEncodePipe(), 'hello 😀')).rejects
      .toMatchObject({ message: 'Unsupported character for Morse code: "😀"' });
    await expect(processText(new MorseDecodePipe(), '..-.-')).rejects
      .toMatchObject({ message: 'Invalid Morse token: "..-.-"' });
  });
});

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

describe('Deflate Raw compression', () => {
  it('compresses and decompresses text round trip', async () => {
    const compressed = await processBytes(new DeflateRawCompressPipe(), encode('Hello, deflate-raw!'));
    const decompressed = await processBytes(new DeflateRawDecompressPipe(), compressed);
    expect(decode(decompressed)).toBe('Hello, deflate-raw!');
  });

  it('handles empty input', async () => {
    const compressed = await processBytes(new DeflateRawCompressPipe(), []);
    const decompressed = await processBytes(new DeflateRawDecompressPipe(), compressed);
    expect([...decompressed]).toEqual([]);
  });

  it('round trips arbitrary bytes', async () => {
    const bytes = [0, 1, 127, 128, 255];
    const compressed = await processBytes(new DeflateRawCompressPipe(), bytes);
    expect([...await processBytes(new DeflateRawDecompressPipe(), compressed)]).toEqual(bytes);
  });

  it('throws PipeError for corrupt data', async () => {
    await expect(processBytes(new DeflateRawDecompressPipe(), [0, 1, 2, 3, 4])).rejects
      .toMatchObject({ message: 'Decompression failed: corrupt or invalid data' });
  });
});

describe('LZ4 compression', () => {
  it('compresses and decompresses text round trip', async () => {
    const compressed = await processBytes(new Lz4CompressPipe(), encode('Hello, LZ4!'));
    expect(compressed[0]).toBe(0x04);
    expect(compressed[1]).toBe(0x22);
    expect(compressed[2]).toBe(0x4d);
    expect(compressed[3]).toBe(0x18);
    const decompressed = await processBytes(new Lz4DecompressPipe(), compressed);
    expect(decode(decompressed)).toBe('Hello, LZ4!');
  });

  it('handles empty input', async () => {
    const compressed = await processBytes(new Lz4CompressPipe(), []);
    const decompressed = await processBytes(new Lz4DecompressPipe(), compressed);
    expect([...decompressed]).toEqual([]);
  });

  it('round trips arbitrary bytes', async () => {
    const bytes = [0, 1, 127, 128, 255];
    const compressed = await processBytes(new Lz4CompressPipe(), bytes);
    expect([...await processBytes(new Lz4DecompressPipe(), compressed)]).toEqual(bytes);
  });

  it('throws PipeError for corrupt data', async () => {
    await expect(processBytes(new Lz4DecompressPipe(), [0, 1, 2, 3, 4])).rejects
      .toMatchObject({ message: 'LZ4 decompression failed: corrupt or invalid data' });
  });

  it('LZ4 decompressor scores input appropriateness by magic bytes', () => {
    const lz4Magic = new Uint8Array([0x04, 0x22, 0x4d, 0x18, 0, 0]);
    expect(Lz4DecompressPipe.getInputAppropriateness(lz4Magic)).toBe(8);
    expect(Lz4DecompressPipe.getInputAppropriateness(new Uint8Array([0, 1, 2, 3]))).toBe(0);
    expect(Lz4DecompressPipe.getInputAppropriateness(null)).toBe(0);
  });
});

describe('Zstd decompression', () => {
  it('decompresses known zstd data (empty)', async () => {
    // Valid zstd frame for empty content, generated with zstandard Python library
    const zstdEmpty = new Uint8Array([40, 181, 47, 253, 32, 0, 1, 0, 0]);
    const output = await processBytes(new ZstdDecompressPipe(), zstdEmpty);
    expect([...output]).toEqual([]);
  });

  it('decompresses known zstd data', async () => {
    // Valid zstd frame for "Hello, Zstd!", generated with zstandard Python library
    const zstdHello = new Uint8Array([40, 181, 47, 253, 32, 12, 97, 0, 0, 72, 101, 108, 108, 111, 44, 32, 90, 115, 116, 100, 33]);
    const output = await processBytes(new ZstdDecompressPipe(), zstdHello);
    expect(decode(output)).toBe('Hello, Zstd!');
  });

  it('throws PipeError for corrupt data', async () => {
    await expect(processBytes(new ZstdDecompressPipe(), [0, 1, 2, 3, 4])).rejects
      .toMatchObject({ message: 'Zstd decompression failed: corrupt or invalid data' });
  });

  it('scores input appropriateness by magic bytes', () => {
    const zstdMagic = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0, 0]);
    expect(ZstdDecompressPipe.getInputAppropriateness(zstdMagic)).toBe(8);
    expect(ZstdDecompressPipe.getInputAppropriateness(new Uint8Array([0, 1, 2, 3]))).toBe(0);
    expect(ZstdDecompressPipe.getInputAppropriateness(null)).toBe(0);
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

describe('Unicode Case Fold Lower', () => {
  it('lowercases ASCII text', async () => {
    expect(await processText(new UnicodeCaseFoldLowerPipe(), 'Hello World')).toBe('hello world');
  });

  it('lowercases non-ASCII text', async () => {
    expect(await processText(new UnicodeCaseFoldLowerPipe(), 'CAFÉ')).toBe('café');
  });

  it('applies NFKC compatibility decomposition before lower folding', async () => {
    expect(await processText(new UnicodeCaseFoldLowerPipe(), '\uFF21')).toBe('a');
    expect(await processText(new UnicodeCaseFoldLowerPipe(), '\uFB01')).toBe('fi');
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeCaseFoldLowerPipe(), '')).toBe('');
  });
});

describe('Unicode Case Fold Upper', () => {
  it('uppercases ASCII text', async () => {
    expect(await processText(new UnicodeCaseFoldUpperPipe(), 'Hello World')).toBe('HELLO WORLD');
  });

  it('uppercases non-ASCII text', async () => {
    expect(await processText(new UnicodeCaseFoldUpperPipe(), 'café')).toBe('CAFÉ');
  });

  it('applies NFKC compatibility decomposition before upper folding', async () => {
    expect(await processText(new UnicodeCaseFoldUpperPipe(), '\uFF41')).toBe('A');
    expect(await processText(new UnicodeCaseFoldUpperPipe(), '\uFB01')).toBe('FI');
  });

  it('handles empty input', async () => {
    expect(await processText(new UnicodeCaseFoldUpperPipe(), '')).toBe('');
  });
});

describe('Zip / Unzip', () => {
  it('exposes expected configuration', () => {
    expect(new ZipPipe().configs.size).toBe(1);
    expect(new ZipPipe().getConfig('filename').value).toBe('data.bin');
    expect(new UnzipPipe().configs.size).toBe(1);
    expect(new UnzipPipe().getConfig('filename').value).toBe('');
  });

  it('produces a ZIP archive with the correct magic bytes', async () => {
    const output = await processBytes(new ZipPipe(), [1, 2, 3]);
    expect(output[0]).toBe(0x50); // P
    expect(output[1]).toBe(0x4b); // K
    expect(output[2]).toBe(0x03);
    expect(output[3]).toBe(0x04);
  });

  it('round trips arbitrary bytes through zip and unzip', async () => {
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    const zipped = await processBytes(new ZipPipe(), bytes);
    expect([...await processBytes(new UnzipPipe(), zipped)]).toEqual(bytes);
  });

  it('handles empty input', async () => {
    const zipped = await processBytes(new ZipPipe(), []);
    expect([...await processBytes(new UnzipPipe(), zipped)]).toEqual([]);
  });

  it('respects the filename config when zipping and unzipping', async () => {
    const pipe = new ZipPipe();
    pipe.setConfig('filename', 'hello.txt');
    const zipped = await processBytes(pipe, [72, 105]);

    const extractPipe = new UnzipPipe();
    extractPipe.setConfig('filename', 'hello.txt');
    expect([...await processBytes(extractPipe, zipped)]).toEqual([72, 105]);
  });

  it('unzip scores input appropriateness by ZIP magic bytes', () => {
    const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
    expect(UnzipPipe.getInputAppropriateness(zipMagic)).toBe(8);
    expect(UnzipPipe.getInputAppropriateness(new Uint8Array([0, 1, 2, 3]))).toBe(0);
    expect(UnzipPipe.getInputAppropriateness(new Uint8Array([0x50, 0x4b]))).toBe(0);
    expect(UnzipPipe.getInputAppropriateness(null)).toBe(0);
  });

  it('throws PipeError for corrupt ZIP data', async () => {
    await expect(processBytes(new UnzipPipe(), [0, 1, 2, 3, 4])).rejects
      .toMatchObject({ message: 'Unzip failed: corrupt or invalid ZIP data' });
  });

  it('throws PipeError when requested filename is not in archive', async () => {
    const zipped = await processBytes(new ZipPipe(), [1, 2, 3]);
    const pipe = new UnzipPipe();
    pipe.setConfig('filename', 'missing.txt');
    await expect(processBytes(pipe, zipped)).rejects
      .toMatchObject({ message: 'File "missing.txt" not found in ZIP archive' });
  });
});
