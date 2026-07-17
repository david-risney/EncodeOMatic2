import { describe, expect, it } from 'vitest';

import { Base64DecodePipe, Base64EncodePipe } from '../src/pipes/builtin/encoding/base64.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('Base64 pipes extra coverage', () => {
  it('round trips every byte value', async () => {
    const bytes = Array.from({ length: 256 }, (_, index) => index);
    const encoded = await processBytes(new Base64EncodePipe(), bytes);

    expect([...await processBytes(new Base64DecodePipe(), encoded)]).toEqual(bytes);
  });

  it.each([
    [[77, 97, 110], 'TWFu'],
    [[77, 97], 'TWE='],
    [[77], 'TQ=='],
  ])('uses standard padding for %j', async (bytes, expected) => {
    expect(decode(await processBytes(new Base64EncodePipe(), bytes))).toBe(expected);
  });

  it('decodes input with leading and trailing whitespace', async () => {
    expect([...await processText(new Base64DecodePipe(), '  QQ==\n')].map(char => char.charCodeAt(0)))
      .toEqual([65]);
  });

  it.each(['Q Q==', 'Q\nQ=='])('decodes internal ASCII whitespace in %j', async (input) => {
    expect(await processText(new Base64DecodePipe(), input)).toBe('A');
    expect(Base64DecodePipe.getInputAppropriateness(encode(input))).toBe(-10);
  });

  it('rejects URL-safe Base64 and non-ASCII decode input', async () => {
    await expect(processText(new Base64DecodePipe(), '__8=')).rejects
      .toMatchObject({ message: 'Invalid Base64 input' });
    await expect(processBytes(new Base64DecodePipe(), [0xFF])).rejects
      .toMatchObject({ message: 'Invalid Base64 input' });
  });

  it('scores decode appropriateness for null, empty, valid, and invalid input', () => {
    expect(Base64DecodePipe.getInputAppropriateness(null)).toBe(0);
    expect(Base64DecodePipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(Base64DecodePipe.getInputAppropriateness(encode('QQ=='))).toBe(10);
    expect(Base64DecodePipe.getInputAppropriateness(encode('%%%'))).toBe(-10);
    expect(Base64DecodePipe.getInputAppropriateness(Uint8Array.from([0, 1, 2]))).toBe(-10);
  });
});
