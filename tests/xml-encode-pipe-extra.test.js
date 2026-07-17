import { describe, expect, it } from 'vitest';

import { XmlDecodePipe, XmlEncodePipe } from '../src/pipes/builtin/encoding/xml-encode.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('XML encode/decode extra coverage', () => {
  it('handles empty string input for encode and decode', async () => {
    expect(await processText(new XmlEncodePipe(), '')).toBe('');
    expect(await processText(new XmlDecodePipe(), '')).toBe('');
  });

  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&apos;'],
  ])('encodes %s as %s', async (input, expected) => {
    expect(await processText(new XmlEncodePipe(), input)).toBe(expected);
  });

  it('round trips encoded XML while preserving surrounding whitespace', async () => {
    const source = '  <tag a="\'">é &\n';
    const encoded = await processText(new XmlEncodePipe(), source);
    expect(await processText(new XmlDecodePipe(), encoded)).toBe(source);
  });

  it('leaves plain ampersands and incomplete entity-like text unchanged on decode', async () => {
    expect(await processText(new XmlDecodePipe(), 'A & B &amp text &#65 text'))
      .toBe('A & B &amp text &#65 text');
  });

  it('decodes standard XML named and numeric entities', async () => {
    expect(await processText(new XmlDecodePipe(), '&amp;&lt;&gt;&quot;&apos;&#65;&#x41;'))
      .toBe('&<>"\'AA');
  });

  it('leaves non-XML named entities unchanged on decode', async () => {
    expect(await processText(new XmlDecodePipe(), '&copy;&nbsp;&unknown;'))
      .toBe('&copy;&nbsp;&unknown;');
  });

  it('leaves out-of-range numeric entities unchanged on decode', async () => {
    expect(await processText(new XmlDecodePipe(), '&#x200000;&#1114112;'))
      .toBe('&#x200000;&#1114112;');
  });

  it('respects inherited non-UTF-8 input decoding on encode', async () => {
    const pipe = new XmlEncodePipe();
    pipe.setConfig('encoding', 'iso-8859-1');

    expect(decode(await processBytes(pipe, [0x3C, 0xE9, 0x26, 0x3E]))).toBe('&lt;é&amp;&gt;');
  });

  it('scores valid, invalid, and absent XML entities', () => {
    expect(XmlDecodePipe.getInputAppropriateness(encode('A &amp; B'))).toBe(10);
    expect(XmlDecodePipe.getInputAppropriateness(encode('A &#65; B'))).toBe(10);
    expect(XmlDecodePipe.getInputAppropriateness(encode('A &#x200000; B'))).toBe(-10);
    expect(XmlDecodePipe.getInputAppropriateness(encode('A &copy; B'))).toBe(-10);
    expect(XmlDecodePipe.getInputAppropriateness(encode('A & B'))).toBe(0);
  });
});
