import { describe, expect, it } from 'vitest';
import { InputPipe } from '../src/pipes/builtin/input-pipe.js';
import { decode, encode } from './helpers.js';

describe('InputPipe extra coverage', () => {
  it('exposes the expected display and default output metadata', () => {
    const pipe = new InputPipe();

    expect(pipe.defaultOutputName).toBe('output');
    expect(pipe.displayName).toBe('Input Buffer');
  });

  it.each([
    ['empty text by default', '', null, []],
    ['text when raw bytes are null', 'Plain text', null, [...encode('Plain text')]],
    ['empty raw bytes before text', 'ignored text', [], []],
  ])('emits %s', async (_caseName, text, rawBytes, expectedBytes) => {
    const pipe = new InputPipe();
    pipe.setConfig('text', text);
    pipe.setConfig('rawBytes', rawBytes);

    const output = (await pipe.process(new Map())).get('output');
    expect([...output]).toEqual(expectedBytes);
  });

  it('prioritizes raw bytes over text when both configs are set', async () => {
    const pipe = new InputPipe();
    pipe.setConfig('text', 'Hello 🌍');
    pipe.setConfig('rawBytes', [0, 255, 65]);

    const output = (await pipe.process(new Map())).get('output');
    expect([...output]).toEqual([0, 255, 65]);
  });

  it.each([
    'café',
    'Привет, 世界',
    '👨🏽‍💻🚀🙂',
  ])('encodes %s as UTF-8 text bytes', async (text) => {
    const pipe = new InputPipe();
    pipe.setConfig('text', text);

    const output = (await pipe.process(new Map())).get('output');
    expect([...output]).toEqual([...encode(text)]);
    expect(decode(output)).toBe(text);
  });

  it('preserves every possible byte value from raw input', async () => {
    const allBytes = Array.from({ length: 256 }, (_unused, index) => index);
    const pipe = new InputPipe();
    pipe.setConfig('text', 'ignored');
    pipe.setConfig('rawBytes', allBytes);

    await pipe.run();
    expect([...pipe.getOutputData()]).toEqual(allBytes);
  });

  it('round-trips text and raw byte configs through JSON serialization', () => {
    const original = new InputPipe();
    original.setConfig('text', 'Hello 🌍');
    original.setConfig('rawBytes', [0, 255, 65]);

    const serialized = original.toJSON();
    const restored = new InputPipe();
    restored.fromJSON(serialized);

    expect(restored.getConfig('text').value).toBe('Hello 🌍');
    expect(restored.getConfig('rawBytes').value).toEqual([0, 255, 65]);
    expect(restored.toJSON().configs).toEqual(serialized.configs);
  });
});
