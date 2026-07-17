import { describe, expect, it } from 'vitest';
import { FileInputPipe } from '../src/pipes/builtin/file-input-pipe.js';

function repeatByteRange(length) {
  return Uint8Array.from({ length }, (_, index) => index % 256);
}

describe('FileInputPipe', () => {
  it('exposes the expected source-pipe defaults', () => {
    const pipe = new FileInputPipe();

    expect(pipe.defineInputs()).toEqual([]);
    expect(pipe.defaultOutputName).toBe('output');
    expect(Object.fromEntries([...pipe.configs].map(([name, config]) => [name, config.value])))
      .toEqual({ fileName: '', fileData: '' });
    expect(pipe.getConfig('fileName')?.type).toBe('string');
    expect(pipe.getConfig('fileData')?.type).toBe('bytes');
  });

  it('returns empty bytes when no file data is configured', async () => {
    const pipe = new FileInputPipe();
    const outputs = await pipe.process(new Map());

    expect(outputs.get('output')).toEqual(new Uint8Array(0));
  });

  it('decodes configured base64 file data to bytes', async () => {
    const pipe = new FileInputPipe();
    pipe.setConfig('fileData', 'AP9BgA==');

    const outputs = await pipe.process(new Map());

    expect([...outputs.get('output')]).toEqual([0, 255, 65, 128]);
  });

  it('round-trips arbitrary bytes through bytesToBase64 and process', async () => {
    const bytes = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);
    const pipe = new FileInputPipe();
    pipe.setConfig('fileData', FileInputPipe.bytesToBase64(bytes));

    const outputs = await pipe.process(new Map());

    expect(outputs.get('output')).toEqual(bytes);
  });

  it('encodes large byte arrays in chunks without changing the base64 output', async () => {
    const bytes = repeatByteRange(0x8000 + 123);
    const base64 = FileInputPipe.bytesToBase64(bytes);
    const pipe = new FileInputPipe();
    pipe.setConfig('fileData', base64);

    const outputs = await pipe.process(new Map());

    expect(base64).toBe(Buffer.from(bytes).toString('base64'));
    expect(outputs.get('output')).toEqual(bytes);
  });

  it('round-trips all 256 byte values', async () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    const pipe = new FileInputPipe();
    pipe.setConfig('fileData', FileInputPipe.bytesToBase64(bytes));

    const outputs = await pipe.process(new Map());

    expect(outputs.get('output')).toEqual(bytes);
  });

  it('serializes and restores fileName and fileData configs', () => {
    const original = new FileInputPipe();
    original.position = { x: 12, y: 34 };
    original.setConfig('fileName', 'café-😀.bin');
    original.setConfig('fileData', 'AP9BgA==');

    const serialized = original.toJSON();
    const restored = new FileInputPipe();
    restored.fromJSON(serialized);

    expect(serialized).toMatchObject({
      type: 'FileInputPipe',
      configs: { fileName: 'café-😀.bin', fileData: 'AP9BgA==' },
      position: { x: 12, y: 34 },
    });
    expect(restored.getConfig('fileName')?.value).toBe('café-😀.bin');
    expect(restored.getConfig('fileData')?.value).toBe('AP9BgA==');
    expect(restored.position).toEqual({ x: 12, y: 34 });
  });

  it('throws on invalid base64 during process and records a wrapped error during run', async () => {
    const pipe = new FileInputPipe();
    pipe.setConfig('fileData', '%%%');

    await expect(pipe.process(new Map())).rejects.toThrow('Invalid character');

    await pipe.run();

    expect(pipe.getOutputData()).toBeNull();
    expect(pipe.errors).toHaveLength(1);
    expect(pipe.errors[0]).toMatchObject({ message: 'Invalid character' });
  });
});
