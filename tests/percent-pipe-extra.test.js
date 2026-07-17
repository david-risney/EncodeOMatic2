import { describe, expect, it } from 'vitest';

import { PercentDecodePipe, PercentEncodePipe } from '../src/pipes/builtin/encoding/percent.js';
import { processBytes, processText } from './helpers.js';

const encodeUtf16Le = (value) => Uint8Array.from(
  [...value].flatMap(char => {
    const code = char.charCodeAt(0);
    return [code & 0xFF, code >> 8];
  })
);

describe('PercentEncodePipe extra coverage', () => {
  it.each(['component', 'full', 'minimal'])('encodes empty input in %s mode', async (mode) => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', mode);
    expect(await processText(pipe, '')).toBe('');
  });

  it('round trips component-mode percent encoding', async () => {
    const source = "a/b café !*'() +";
    const encoded = await processText(new PercentEncodePipe(), source);
    expect(encoded).toBe('a%2Fb%20caf%C3%A9%20%21%2A%27%28%29%20%2B');
    expect(await processText(new PercentDecodePipe(), encoded)).toBe(source);
  });

  it('round trips minimal-mode percent encoding, including astral Unicode', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', 'minimal');

    const source = 'emoji 😀 / café';
    const encoded = await processText(pipe, source);
    expect(encoded).toBe('emoji%20%F0%9F%98%80%20%2F%20caf%C3%A9');
    expect(await processText(new PercentDecodePipe(), encoded)).toBe(source);
  });

  it('honors configured source-byte decoding before percent-encoding', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('encoding', 'iso-8859-1');
    expect(await processBytes(pipe, [0x63, 0x61, 0x66, 0xE9])).toEqual(
      new TextEncoder().encode('caf%C3%A9')
    );
  });

  it('persists the selected mode via setConfig', async () => {
    const pipe = new PercentEncodePipe();
    pipe.setConfig('mode', 'minimal');

    expect(pipe.getConfig('mode')?.value).toBe('minimal');
    expect(await processText(pipe, 'a/b')).toBe('a%2Fb');

    pipe.setConfig('mode', 'full');
    expect(pipe.getConfig('mode')?.value).toBe('full');
    expect(await processText(pipe, 'https://x.test/a b?q=1')).toBe('https://x.test/a%20b?q=1');
  });
});

describe('PercentDecodePipe extra coverage', () => {
  it('decodes empty input', async () => {
    expect(await processText(new PercentDecodePipe(), '')).toBe('');
  });

  it('does not treat plus as a space and decodes %2B back to plus', async () => {
    expect(await processText(new PercentDecodePipe(), 'a+b')).toBe('a+b');
    expect(await processText(new PercentDecodePipe(), '%2B')).toBe('+');
  });

  it('decodes %00 to a null byte in the output string', async () => {
    const decoded = await processText(new PercentDecodePipe(), '%00');
    expect(decoded).toHaveLength(1);
    expect(decoded.charCodeAt(0)).toBe(0);
  });

  it('honors configured source-byte decoding before percent-decoding', async () => {
    const pipe = new PercentDecodePipe();
    pipe.setConfig('encoding', 'utf-16le');
    expect(await processBytes(pipe, encodeUtf16Le('caf%C3%A9'))).toEqual(
      new TextEncoder().encode('café')
    );
  });

  it.each([
    ['null input', null, 0],
    ['empty input', new Uint8Array(), 0],
    ['plain text without percent escapes', new TextEncoder().encode('plain text'), 0],
    ['valid percent-encoded text', new TextEncoder().encode('caf%C3%A9'), 10],
    ['malformed percent sequence', new TextEncoder().encode('bad%2value'), -10],
    ['invalid UTF-8 bytes', Uint8Array.of(0xFF), -10],
  ])('scores %s correctly', (_label, input, expected) => {
    expect(PercentDecodePipe.getInputAppropriateness(input)).toBe(expected);
  });
});
