import { describe, expect, it } from 'vitest';
import { TarCreatePipe, TarExtractPipe } from '../src/pipes/builtin/encoding/tar.js';
import { processBytes, encode, decode } from './helpers.js';

describe('Tar Create', () => {
  it('exposes expected default configuration', () => {
    const pipe = new TarCreatePipe();
    expect(pipe.configs.get('filename').value).toBe('file');
  });

  it('creates a non-empty tar archive from input bytes', async () => {
    const input = [104, 101, 108, 108, 111]; // "hello"
    const output = await processBytes(new TarCreatePipe(), input);
    // Tar must be at least 1024 bytes (one file block + two end blocks)
    expect(output.length).toBeGreaterThanOrEqual(1024);
    // POSIX tar: "ustar" magic at offset 257
    expect(output[257]).toBe(0x75); // 'u'
    expect(output[258]).toBe(0x73); // 's'
    expect(output[259]).toBe(0x74); // 't'
    expect(output[260]).toBe(0x61); // 'a'
    expect(output[261]).toBe(0x72); // 'r'
  });

  it('encodes the filename in the tar header', async () => {
    const pipe = new TarCreatePipe();
    pipe.setConfig('filename', 'hello.txt');
    const output = await processBytes(pipe, [1, 2, 3]);
    // First 100 bytes of a tar header are the filename
    const headerName = new TextDecoder().decode(output.slice(0, 9));
    expect(headerName).toBe('hello.txt');
  });

  it('handles empty input', async () => {
    const output = await processBytes(new TarCreatePipe(), []);
    expect(output.length).toBeGreaterThanOrEqual(512);
  });
});

describe('Tar Extract', () => {
  it('exposes expected default configuration', () => {
    const pipe = new TarExtractPipe();
    expect(pipe.configs.get('fileIndex').value).toBe(0);
  });

  it('round-trips bytes through create and extract', async () => {
    const input = [104, 101, 108, 108, 111]; // "hello"
    const tarBytes = await processBytes(new TarCreatePipe(), input);
    const extracted = await processBytes(new TarExtractPipe(), tarBytes);
    expect([...extracted]).toEqual(input);
  });

  it('round-trips arbitrary bytes through create and extract', async () => {
    const input = Array.from({ length: 256 }, (_, i) => i);
    const tarBytes = await processBytes(new TarCreatePipe(), input);
    const extracted = await processBytes(new TarExtractPipe(), tarBytes);
    expect([...extracted]).toEqual(input);
  });

  it('handles empty input bytes in archive', async () => {
    const tarBytes = await processBytes(new TarCreatePipe(), []);
    const extracted = await processBytes(new TarExtractPipe(), tarBytes);
    expect([...extracted]).toEqual([]);
  });

  it('returns empty bytes for empty archive input', async () => {
    const extracted = await processBytes(new TarExtractPipe(), []);
    expect([...extracted]).toEqual([]);
  });

  it('throws PipeError for invalid tar data', async () => {
    await expect(processBytes(new TarExtractPipe(), [1, 2, 3, 4, 5])).rejects
      .toMatchObject({ message: expect.stringMatching(/tar/i) });
  });

  it('throws PipeError when fileIndex is out of range', async () => {
    const tarBytes = await processBytes(new TarCreatePipe(), [1, 2, 3]);
    const pipe = new TarExtractPipe();
    pipe.setConfig('fileIndex', 5);
    await expect(processBytes(pipe, tarBytes)).rejects
      .toMatchObject({ message: expect.stringMatching(/out of range/i) });
  });

  it('scores tar input appropriateness by ustar magic bytes', () => {
    // Create a buffer with ustar magic at offset 257
    const buf = new Uint8Array(512);
    buf[257] = 0x75; buf[258] = 0x73; buf[259] = 0x74; buf[260] = 0x61; buf[261] = 0x72;
    expect(TarExtractPipe.getInputAppropriateness(buf)).toBe(8);
    expect(TarExtractPipe.getInputAppropriateness(new Uint8Array([0, 1, 2]))).toBe(0);
    expect(TarExtractPipe.getInputAppropriateness(null)).toBe(0);
  });
});
