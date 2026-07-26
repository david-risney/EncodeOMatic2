import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { WebInputPipe } from '../src/pipes/builtin/web-input-pipe.js';

describe('WebInputPipe', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the expected source-pipe defaults', () => {
    const pipe = new WebInputPipe();

    expect(pipe.defineInputs()).toEqual([]);
    expect(pipe.defaultOutputName).toBe('output');
    expect(pipe.displayName).toBe('Web Input');
    expect(Object.fromEntries([...pipe.configs].map(([name, cfg]) => [name, cfg.value])))
      .toEqual({ url: '' });
    expect(pipe.getConfig('url')?.type).toBe('string');
  });

  it('returns empty bytes when url is empty', async () => {
    const pipe = new WebInputPipe();
    const outputs = await pipe.process(new Map());

    expect(outputs.get('output')).toEqual(new Uint8Array(0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches the configured URL with CORS mode and returns response bytes', async () => {
    const responseBytes = new Uint8Array([72, 101, 108, 108, 111]);
    fetchSpy.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(responseBytes.buffer),
    });

    const pipe = new WebInputPipe();
    pipe.setConfig('url', 'https://example.com/data');
    const outputs = await pipe.process(new Map());

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/data', { mode: 'cors' });
    expect(outputs.get('output')).toEqual(responseBytes);
  });

  it('throws PipeError on non-ok HTTP response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    const pipe = new WebInputPipe();
    pipe.setConfig('url', 'https://example.com/secret');

    await expect(pipe.process(new Map())).rejects.toMatchObject({
      message: 'HTTP 403: Forbidden',
    });
  });

  it('throws PipeError when fetch itself rejects (network error)', async () => {
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));

    const pipe = new WebInputPipe();
    pipe.setConfig('url', 'https://example.com/fail');

    await expect(pipe.process(new Map())).rejects.toMatchObject({
      message: 'Fetch failed: Failed to fetch',
    });
  });

  it('records error and produces no output when fetch fails during run', async () => {
    fetchSpy.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'));

    const pipe = new WebInputPipe();
    pipe.setConfig('url', 'https://example.com/fail');

    await pipe.run();

    expect(pipe.getOutputData()).toBeNull();
    expect(pipe.errors).toHaveLength(1);
    expect(pipe.errors[0].message).toMatch('net::ERR_CONNECTION_REFUSED');
  });

  it('records error and produces no output on HTTP error during run', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const pipe = new WebInputPipe();
    pipe.setConfig('url', 'https://example.com/missing');

    await pipe.run();

    expect(pipe.getOutputData()).toBeNull();
    expect(pipe.errors).toHaveLength(1);
    expect(pipe.errors[0].message).toBe('HTTP 404: Not Found');
  });

  it('serializes and restores url config', () => {
    const original = new WebInputPipe();
    original.position = { x: 10, y: 20 };
    original.setConfig('url', 'https://example.com/test');

    const serialized = original.toJSON();
    const restored = new WebInputPipe();
    restored.fromJSON(serialized);

    expect(serialized).toMatchObject({
      type: 'WebInputPipe',
      configs: { url: 'https://example.com/test' },
      position: { x: 10, y: 20 },
    });
    expect(restored.getConfig('url')?.value).toBe('https://example.com/test');
    expect(restored.position).toEqual({ x: 10, y: 20 });
  });

  it('returns empty bytes when url is reset to empty string', async () => {
    const pipe = new WebInputPipe();
    pipe.setConfig('url', '');
    const outputs = await pipe.process(new Map());

    expect(outputs.get('output')).toEqual(new Uint8Array(0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
