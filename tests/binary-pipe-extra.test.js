import { describe, expect, it } from 'vitest';

import { BinaryDecodePipe, BinaryEncodePipe } from '../src/pipes/builtin/encoding/binary.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('binary pipes extra coverage', () => {
  it.each([
    [' ', '00000000 00000001 01111111 10000000 11111111'],
    [',', '00000000,00000001,01111111,10000000,11111111'],
    ['', '0000000000000001011111111000000011111111'],
  ])('round trips bytes with %j separator', async (separator, expected) => {
    const encoder = new BinaryEncodePipe();
    const bytes = [0, 1, 127, 128, 255];
    encoder.setConfig('separator', separator);

    const encoded = await processBytes(encoder, bytes);

    expect(decode(encoded)).toBe(expected);
    expect([...await processBytes(new BinaryDecodePipe(), encoded)]).toEqual(bytes);
  });

  it('encodes and decodes single bytes and the full byte range', async () => {
    expect(await processText(new BinaryEncodePipe(), 'A')).toBe('01000001');
    expect([...await processBytes(new BinaryDecodePipe(), encode('01000001'))]).toEqual([65]);

    const allBytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    const encoded = await processBytes(new BinaryEncodePipe(), allBytes);

    expect(decode(encoded).split(' ').slice(0, 4)).toEqual([
      '00000000',
      '00000001',
      '00000010',
      '00000011',
    ]);
    expect(decode(encoded).split(' ').slice(-4)).toEqual([
      '11111100',
      '11111101',
      '11111110',
      '11111111',
    ]);
    expect([...await processBytes(new BinaryDecodePipe(), encoded)]).toEqual([...allBytes]);
  });

  it('decodes whitespace-only, comma-separated, and mixed comma/whitespace input', async () => {
    expect(await processText(new BinaryDecodePipe(), ' \n\t  ')).toBe('');
    expect([...await processBytes(new BinaryDecodePipe(), encode('00000001,11111111'))])
      .toEqual([1, 255]);
    expect([...await processBytes(new BinaryDecodePipe(), encode('00000001,\n 11111111\t,00110011'))])
      .toEqual([1, 255, 51]);
  });

  it('accepts short tokens but rejects non-byte-length long tokens', async () => {
    expect([...await processBytes(new BinaryDecodePipe(), encode('1 101'))]).toEqual([1, 5]);
    await expect(processText(new BinaryDecodePipe(), '100000000')).rejects
      .toMatchObject({
        message: 'Invalid binary byte at position 0: "100000000"',
        selections: [{ index: 0, length: 9 }],
      });
  });

  it('scores complete, partial, malformed, and concatenated binary input', () => {
    expect(BinaryDecodePipe.getInputAppropriateness(encode('00000000'))).toBe(10);
    expect(BinaryDecodePipe.getInputAppropriateness(encode('11111111'))).toBe(10);
    expect(BinaryDecodePipe.getInputAppropriateness(encode('101'))).toBe(5);
    expect(BinaryDecodePipe.getInputAppropriateness(encode('0100000101000010'))).toBe(10);
    expect(BinaryDecodePipe.getInputAppropriateness(encode('010101010'))).toBe(-10);
    expect(BinaryDecodePipe.getInputAppropriateness(encode('102'))).toBe(-10);
  });

  it('reports invalid token selections at the correct byte offset', async () => {
    await expect(processText(new BinaryDecodePipe(), '00000001, ,2')).rejects
      .toMatchObject({
        message: 'Invalid binary byte at position 1: "2"',
        selections: [{ index: 11, length: 1 }],
      });
    await expect(processText(new BinaryDecodePipe(), '00000001,ab')).rejects
      .toMatchObject({
        message: 'Invalid binary byte at position 1: "ab"',
        selections: [{ index: 9, length: 2 }],
      });
  });

  it('translates selections for binary encode and decode', async () => {
    const encoder = new BinaryEncodePipe();
    encoder.setConfig('separator', ',');
    encoder.setInputData('input', encode('AB'));
    await encoder.run();
    expect(encoder.translateSelections('input', 'input', 'output', 'output', [
      { index: 1, length: 1 },
    ])).toEqual([{ index: 9, length: 8 }]);
    expect(encoder.translateSelections('output', 'output', 'input', 'input', [
      { index: 9, length: 8 },
    ])).toEqual([{ index: 1, length: 1 }]);

    const decoder = new BinaryDecodePipe();
    decoder.setInputData('input', encode('01000001,01000010'));
    await decoder.run();
    expect(decoder.translateSelections('input', 'input', 'output', 'output', [
      { index: 9, length: 8 },
    ])).toEqual([{ index: 1, length: 1 }]);
    expect(decoder.translateSelections('output', 'output', 'input', 'input', [
      { index: 1, length: 1 },
    ])).toEqual([{ index: 9, length: 8 }]);
  });
});
