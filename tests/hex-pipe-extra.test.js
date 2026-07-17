import { describe, expect, it } from 'vitest';

import { Pipe } from '../src/pipes/pipe.js';
import { HexEncodePipe, HexDecodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('HexEncodePipe extra coverage', () => {
  it.each([
    [0x00, '00'],
    [0xFF, 'FF'],
    [0x0A, '0A'],
  ])('encodes single byte %# as two uppercase digits', async (byte, expected) => {
    expect(decode(await processBytes(new HexEncodePipe(), [byte]))).toBe(expected);
  });

  it('respects uppercase and multi-character separator configs', async () => {
    const uppercase = new HexEncodePipe();
    uppercase.setConfig('separator', ', ');
    expect(decode(await processBytes(uppercase, [0x00, 0x0A, 0xFF]))).toBe('00, 0A, FF');

    const lowercase = new HexEncodePipe();
    lowercase.setConfig('separator', '0x');
    lowercase.setConfig('uppercase', false);
    expect(decode(await processBytes(lowercase, [0x00, 0x0A, 0xFF]))).toBe('000x0a0xff');
  });

  it('translates selections with no separator, multi-byte input, and empty selections', async () => {
    const pipe = new HexEncodePipe();
    pipe.setInputData('input', encode('A😀B'));
    await pipe.run();

    expect(pipe.translateSelections('input', 'input', 'output', 'output', [])).toEqual([]);
    expect(pipe.translateSelections('input', 'input', 'output', 'output', [
      { index: 0, length: 1 },
      { index: 1, length: 4 },
      { index: 0, length: 6 },
    ])).toEqual([
      { index: 0, length: 2 },
      { index: 2, length: 8 },
      { index: 0, length: 12 },
    ]);
    expect(pipe.translateSelections('output', 'output', 'input', 'input', [
      { index: 0, length: 2 },
      { index: 2, length: 8 },
      { index: 0, length: 12 },
    ])).toEqual([
      { index: 0, length: 1 },
      { index: 1, length: 4 },
      { index: 0, length: 6 },
    ]);
  });

  it('uses UTF-8 byte length for separator-aware selection translation', async () => {
    const pipe = new HexEncodePipe();
    pipe.setConfig('separator', '😀');
    pipe.setInputData('input', Uint8Array.from([0x00, 0x11, 0x22]));
    await pipe.run();

    expect(decode(pipe.getOutputData())).toBe('00😀11😀22');
    expect(pipe.translateSelections('input', 'input', 'output', 'output', [
      { index: 1, length: 2 },
    ])).toEqual([{ index: 6, length: 8 }]);
    expect(pipe.translateSelections('output', 'output', 'input', 'input', [
      { index: 6, length: 8 },
    ])).toEqual([{ index: 1, length: 2 }]);
  });

  it('falls back to default ports when port types are null', async () => {
    const pipe = new HexEncodePipe();
    pipe.setConfig('separator', ':');
    pipe.setInputData('input', Uint8Array.from([0x00, 0x11]));
    await pipe.run();

    expect(pipe.translateSelections(null, 'input', null, 'output', [
      { index: 1, length: 1 },
    ])).toEqual([{ index: 3, length: 2 }]);
    expect(pipe.translateSelections(null, 'output', null, 'input', [
      { index: 3, length: 2 },
    ])).toEqual([{ index: 1, length: 1 }]);
  });

  it('does not override getInputAppropriateness because any bytes are valid input', () => {
    expect(Object.hasOwn(HexEncodePipe, 'getInputAppropriateness')).toBe(false);
    expect(HexEncodePipe.getInputAppropriateness(new Uint8Array([0x00, 0xFF]))).toBe(0);
    expect(HexEncodePipe.getInputAppropriateness(null)).toBe(Pipe.getInputAppropriateness(null));
  });
});

describe('HexDecodePipe extra coverage', () => {
  it('decodes mixed separators, empty input, and separator-only input', async () => {
    expect([...await processBytes(new HexDecodePipe(), encode('00 -0a: FF'))]).toEqual([0, 10, 255]);
    expect(await processText(new HexDecodePipe(), '')).toBe('');
    expect(await processText(new HexDecodePipe(), '   -:😀')).toBe('');
  });

  it('reports the last digit byte offset for odd digit counts', async () => {
    await expect(processText(new HexDecodePipe(), '00😀a')).rejects.toMatchObject({
      message: 'Hex string has odd number of digits',
      selections: [{ index: 6, length: 1 }],
    });
  });

  it('translates selections for multi-byte input in both directions', async () => {
    const pipe = new HexDecodePipe();
    pipe.setInputData('input', encode('41😀42😀43'));
    await pipe.run();

    expect([...pipe.getOutputData()]).toEqual([0x41, 0x42, 0x43]);
    expect(pipe.translateSelections('input', 'input', 'output', 'output', [])).toEqual([]);
    expect(pipe.translateSelections('input', 'input', 'output', 'output', [
      { index: 0, length: 2 },
      { index: 6, length: 2 },
      { index: 0, length: encode('41😀42😀43').length },
    ])).toEqual([
      { index: 0, length: 1 },
      { index: 1, length: 1 },
      { index: 0, length: 3 },
    ]);
    expect(pipe.translateSelections('output', 'output', 'input', 'input', [
      { index: 0, length: 1 },
      { index: 1, length: 1 },
      { index: 0, length: 3 },
    ])).toEqual([
      { index: 0, length: 2 },
      { index: 6, length: 2 },
      { index: 0, length: 14 },
    ]);
  });

  it('scores hex-like input and rejects malformed candidates', () => {
    expect(HexDecodePipe.getInputAppropriateness(encode('de ad be ef'))).toBe(10);
    expect(HexDecodePipe.getInputAppropriateness(encode('abc'))).toBe(-10);
    expect(HexDecodePipe.getInputAppropriateness(encode('g0'))).toBe(-10);
    expect(HexDecodePipe.getInputAppropriateness(encode(''))).toBe(0);
    expect(HexDecodePipe.getInputAppropriateness(null)).toBe(0);
  });
});
