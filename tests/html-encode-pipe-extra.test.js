import { describe, expect, it } from 'vitest';

import { HtmlDecodePipe, HtmlEncodePipe } from '../src/pipes/builtin/encoding/html-encode.js';
import { decode, processBytes, processText } from './helpers.js';

describe('HTML encode pipe extra coverage', () => {
  it('handles empty strings and persists mode config changes', async () => {
    const encoder = new HtmlEncodePipe();

    expect(await processText(encoder, '')).toBe('');
    expect(await processText(new HtmlDecodePipe(), '')).toBe('');
    expect(encoder.getConfig('mode')?.value).toBe('minimal');

    encoder.setConfig('mode', 'all-non-ascii');
    expect(encoder.getConfig('mode')?.value).toBe('all-non-ascii');
  });

  it('encodes greater-than in minimal mode and leaves ASCII unchanged in all-non-ascii mode', async () => {
    const minimal = new HtmlEncodePipe();
    expect(await processText(minimal, '>')).toBe('&gt;');

    const allNonAscii = new HtmlEncodePipe();
    allNonAscii.setConfig('mode', 'all-non-ascii');
    expect(await processText(allNonAscii, ' 123 AZ az !?')).toBe(' 123 AZ az !?');
  });

  it('round trips minimal and all-non-ascii HTML entity encoding', async () => {
    const minimalSource = `<tag title="'">© & 😀</tag>`;
    const minimalEncoded = await processText(new HtmlEncodePipe(), minimalSource);
    expect(await processText(new HtmlDecodePipe(), minimalEncoded)).toBe(minimalSource);

    const allNonAsciiEncoder = new HtmlEncodePipe();
    allNonAsciiEncoder.setConfig('mode', 'all-non-ascii');
    const allNonAsciiSource = `© 😀 <>&"'`;
    const allNonAsciiEncoded = await processText(allNonAsciiEncoder, allNonAsciiSource);
    expect(await processText(new HtmlDecodePipe(), allNonAsciiEncoded)).toBe(allNonAsciiSource);
  });

  it('respects non-UTF-8 input encoding when encoding HTML', async () => {
    const encoder = new HtmlEncodePipe();
    encoder.setConfig('encoding', 'windows-1252');
    encoder.setConfig('mode', 'all-non-ascii');

    expect(decode(await processBytes(encoder, [0x80, 0x20, 0x31, 0x26]))).toBe('&euro; 1&amp;');
  });
});

describe('HTML decode pipe extra coverage', () => {
  it('decodes additional named, decimal, and hex entity forms', async () => {
    expect(await processText(new HtmlDecodePipe(), '&gt;&apos;&#65;&#x0041;')).toBe(`>'AA`);
    // &#x0; is a parse error in HTML5 and is replaced with the replacement char U+FFFD
    expect(await processText(new HtmlDecodePipe(), '&#x0;&#x10FFFF;'))
      .toBe('\uFFFD' + String.fromCodePoint(0x10FFFF));
  });

  it('leaves malformed non-hex entities unchanged and maps out-of-range code points to U+FFFD', async () => {
    expect(await processText(new HtmlDecodePipe(), '&#xZZZ;')).toBe('&#xZZZ;');
    // Code points above U+10FFFF are out-of-range parse errors; he maps them to U+FFFD
    expect(await processText(new HtmlDecodePipe(), '&#x200000;')).toBe('\uFFFD');
  });
});

describe('HTML decode input appropriateness', () => {
  const encode = value => new TextEncoder().encode(value);

  it('scores valid, malformed, and plain inputs distinctly', () => {
    expect(HtmlDecodePipe.getInputAppropriateness(encode('&amp;'))).toBe(10);
    expect(HtmlDecodePipe.getInputAppropriateness(encode('&amp'))).toBe(-10);
    expect(HtmlDecodePipe.getInputAppropriateness(encode('&unknown;'))).toBe(-10);
    expect(HtmlDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
  });
});
