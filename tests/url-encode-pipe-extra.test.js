import { describe, expect, it } from 'vitest';

import { UrlEncodePipe, UrlDecodePipe } from '../src/pipes/builtin/encoding/url-encode.js';
import { decode, processBytes, processText } from './helpers.js';

const encodeUtf8 = value => new TextEncoder().encode(value);

describe('URL encode/decode extra coverage', () => {
  it('handles empty strings and preserves encodeURI reserved characters', async () => {
    expect(await processText(new UrlEncodePipe(), '')).toBe('');
    expect(await processText(new UrlDecodePipe(), '')).toBe('');
    expect(await processText(new UrlEncodePipe(), "~!@#$&*()=:/,;?+'")).toBe("~!@#$&*()=:/,;?+'");
  });

  it('round-trips full URLs with path, query, fragment, and non-ASCII text', async () => {
    const input = "https://example.com/café/a b?q=one+two&note=semi;comma,apostrophe'paren()#frag ment";
    const encoded = await processText(new UrlEncodePipe(), input);

    expect(encoded)
      .toBe("https://example.com/caf%C3%A9/a%20b?q=one+two&note=semi;comma,apostrophe'paren()#frag%20ment");
    expect(await processText(new UrlDecodePipe(), encoded)).toBe(input);
  });

  it('decodes non-reserved sequences but preserves reserved URI delimiters', async () => {
    expect(await processText(new UrlDecodePipe(), 'https://example.com/a%2Fb?q=x%20y%2Bz%23frag'))
      .toBe('https://example.com/a%2Fb?q=x y%2Bz%23frag');
  });

  it('decodes input bytes using the configured text encoding before encodeURI', async () => {
    const pipe = new UrlEncodePipe();
    pipe.setConfig('encoding', 'iso-8859-1');

    expect(decode(await processBytes(pipe, [0x63, 0x61, 0x66, 0xE9]))).toBe('caf%C3%A9');
    await expect(processBytes(new UrlEncodePipe(), [0x63, 0x61, 0x66, 0xE9])).rejects
      .toMatchObject({ message: 'Cannot decode input bytes as utf-8' });
  });

  it('scores encoded, plain, malformed, and reserved-only URI input appropriately', () => {
    expect(UrlDecodePipe.getInputAppropriateness(encodeUtf8('https://example.com/a%20b'))).toBe(10);
    expect(UrlDecodePipe.getInputAppropriateness(encodeUtf8('https://example.com/%23frag'))).toBe(10);
    expect(UrlDecodePipe.getInputAppropriateness(encodeUtf8('https://example.com/plain'))).toBe(0);
    expect(UrlDecodePipe.getInputAppropriateness(encodeUtf8('https://example.com/%2G'))).toBe(-10);
    expect(UrlDecodePipe.getInputAppropriateness(Uint8Array.from([0xFF]))).toBe(-10);
  });

  it('rejects malformed URI sequences and unpaired surrogates', async () => {
    await expect(processText(new UrlDecodePipe(), '%E0%A4%A')).rejects
      .toMatchObject({ message: 'Invalid URI encoding in input' });
    await expect(new UrlEncodePipe().processString('\uDC00')).rejects
      .toMatchObject({ message: 'Cannot encode input as URI' });
  });
});
