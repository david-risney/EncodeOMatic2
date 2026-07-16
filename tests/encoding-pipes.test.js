import { describe, expect, it } from 'vitest';
import { InputPipe } from '../src/pipes/builtin/input-pipe.js';
import { Base64EncodePipe, Base64DecodePipe } from '../src/pipes/builtin/encoding/base64.js';
import { PercentEncodePipe, PercentDecodePipe } from '../src/pipes/builtin/encoding/percent.js';
import { HexEncodePipe, HexDecodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { BinaryEncodePipe, BinaryDecodePipe } from '../src/pipes/builtin/encoding/binary.js';
import { HtmlEncodePipe, HtmlDecodePipe } from '../src/pipes/builtin/encoding/html-encode.js';
import { XmlEncodePipe, XmlDecodePipe } from '../src/pipes/builtin/encoding/xml-encode.js';
import { CharsetDecodePipe, CharsetEncodePipe } from '../src/pipes/builtin/encoding/charset.js';
import { SlashEscapePipe, SlashUnescapePipe } from '../src/pipes/builtin/encoding/slash-escape.js';
import { UrlEncodePipe, UrlDecodePipe } from '../src/pipes/builtin/encoding/url-encode.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('source and byte encodings', () => {
  it.each([
    [InputPipe, { text: '', rawBytes: null }],
    [Base64EncodePipe, {}],
    [Base64DecodePipe, {}],
    [HexEncodePipe, { separator: '', uppercase: true }],
    [HexDecodePipe, {}],
    [BinaryEncodePipe, { separator: ' ' }],
    [BinaryDecodePipe, {}],
    [PercentEncodePipe, { encoding: 'utf-8', mode: 'component' }],
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
    expect(await processText(encoder, '© 😀')).toBe('&#xA9; &#x1F600;');
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
    ['&amp &bogus; &#xZZ;', '&amp &bogus; &#xZZ;'],
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
    ['iso-8859-1', [0x41, 0xe9]],
    ['shift_jis', [0x41]],
  ])('decodes representative %s input', async (encoding, bytes) => {
    const pipe = new CharsetDecodePipe();
    pipe.setConfig('fromEncoding', encoding);
    const expected = new TextDecoder(encoding, { fatal: true }).decode(Uint8Array.from(bytes));
    expect(decode(await processBytes(pipe, bytes))).toBe(expected);
  });

  it('encodes UTF-8 to UTF-8 and both UTF-16 byte orders', async () => {
    const pipe = new CharsetEncodePipe();
    expect([...await processBytes(pipe, encode('A😀'))]).toEqual([...encode('A😀')]);
    pipe.setConfig('toEncoding', 'utf-16le');
    expect([...await processBytes(pipe, encode('A😀'))])
      .toEqual([0x41, 0, 0x3d, 0xd8, 0, 0xde]);
    pipe.setConfig('toEncoding', 'utf-16be');
    expect([...await processBytes(pipe, encode('A😀'))])
      .toEqual([0, 0x41, 0xd8, 0x3d, 0xde, 0]);
    pipe.setConfig('toEncoding', 'windows-1252');
    expect(decode(await processBytes(pipe, encode('fallback')))).toBe('fallback');
    await expect(processBytes(pipe, [0xff])).rejects.toMatchObject({
      message: expect.stringContaining('Input bytes are not valid UTF-8'),
    });
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
