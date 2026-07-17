import { describe, expect, it } from 'vitest';

import { CharsetDecodePipe, CharsetEncodePipe } from '../src/pipes/builtin/encoding/charset.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('charset pipe extra coverage', () => {
  it('handles empty inputs for both decode and encode pipes', async () => {
    expect(await processBytes(new CharsetDecodePipe(), [])).toHaveLength(0);
    expect(await processBytes(new CharsetEncodePipe(), [])).toHaveLength(0);
  });

  it('strips BOMs when decoding UTF-8, UTF-16LE, and UTF-32BE input', async () => {
    const utf8Pipe = new CharsetDecodePipe();
    utf8Pipe.setConfig('fromEncoding', 'utf-8');
    expect(decode(await processBytes(utf8Pipe, [0xEF, 0xBB, 0xBF, 0x41]))).toBe('A');

    const utf16lePipe = new CharsetDecodePipe();
    utf16lePipe.setConfig('fromEncoding', 'utf-16le');
    expect(decode(await processBytes(utf16lePipe, [0xFF, 0xFE, 0x41, 0x00]))).toBe('A');

    const utf32bePipe = new CharsetDecodePipe();
    utf32bePipe.setConfig('fromEncoding', 'utf-32be');
    expect(decode(await processBytes(utf32bePipe, [
      0x00, 0x00, 0xFE, 0xFF,
      0x00, 0x00, 0x00, 0x41,
    ]))).toBe('A');
  });

  it('surfaces replacement characters for invalid bytes when fatal decoding is disabled', async () => {
    const pipe = new CharsetDecodePipe();
    pipe.setConfig('fromEncoding', 'utf-8');
    pipe.setConfig('fatal', false);
    expect(decode(await processBytes(pipe, [0xE2, 0x28, 0xA1]))).toBe('�(�');
  });

  it('reports unsupported charset names on decode and encode', async () => {
    const decoder = new CharsetDecodePipe();
    decoder.setConfig('fromEncoding', 'definitely-not-an-encoding');
    await expect(processBytes(decoder, [0x41])).rejects.toMatchObject({
      message: expect.stringContaining('Cannot decode bytes as definitely-not-an-encoding'),
    });

    const encoder = new CharsetEncodePipe();
    encoder.setConfig('toEncoding', 'definitely-not-an-encoding');
    await expect(processText(encoder, 'A')).rejects.toMatchObject({
      message: 'Encoding to definitely-not-an-encoding is not supported',
    });
  });

  it('maps charset input appropriateness for BOM signatures and UTF-8 validity', () => {
    expect(CharsetDecodePipe.getInputAppropriateness(new Uint8Array([0xEF, 0xBB, 0xBF, 0x41]))).toBe(10);
    expect(CharsetDecodePipe.getInputAppropriateness(new Uint8Array([0x00, 0x00, 0xFE, 0xFF, 0x00]))).toBe(10);
    expect(CharsetDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
    expect(CharsetDecodePipe.getInputAppropriateness(new Uint8Array([0x00, 0xFF, 0x00]))).toBe(0);
    expect(CharsetDecodePipe.getInputAppropriateness(null)).toBe(0);

    expect(CharsetEncodePipe.getInputAppropriateness(encode('plain text'))).toBe(5);
    expect(CharsetEncodePipe.getInputAppropriateness(new Uint8Array([0xFF]))).toBe(-10);
    expect(CharsetEncodePipe.getInputAppropriateness(null)).toBe(0);
  });

  it('round trips windows-1252 text through encode then decode', async () => {
    const source = 'Résumé €';
    const encoder = new CharsetEncodePipe();
    encoder.setConfig('toEncoding', 'windows-1252');
    const encoded = await processBytes(encoder, encode(source));

    const decoder = new CharsetDecodePipe();
    decoder.setConfig('fromEncoding', 'windows-1252');
    expect(decode(await processBytes(decoder, encoded))).toBe(source);
  });

  it('encodes unmappable emoji as question marks in shift_jis', async () => {
    const pipe = new CharsetEncodePipe();
    pipe.setConfig('toEncoding', 'shift_jis');
    expect([...await processBytes(pipe, encode('😀'))]).toEqual([0x3F]);
  });

  it('matches WHATWG latin1 decoding for the full upper-half byte range', async () => {
    const bytes = Uint8Array.from(Array.from({ length: 128 }, (_, index) => index + 0x80));
    const pipe = new CharsetDecodePipe();
    pipe.setConfig('fromEncoding', 'latin1');
    const expected = new TextDecoder('latin1', { fatal: true }).decode(bytes);
    expect(decode(await processBytes(pipe, bytes))).toBe(expected);
  });
});
