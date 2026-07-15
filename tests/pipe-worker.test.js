import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('pipe worker message handler', () => {
  beforeEach(async () => {
    vi.resetModules();
    self.postMessage = vi.fn();
    await import('../src/worker/pipe-worker.js');
  });

  it('ignores unrelated messages and rejects unknown pipe types', async () => {
    await self.onmessage({ data: { type: 'other' } });
    expect(self.postMessage).not.toHaveBeenCalled();
    await self.onmessage({
      data: { type: 'process', id: 1, pipeType: '<script>unknown</script>' },
    });
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'result',
      id: 1,
      outputs: {},
      errors: [{ message: 'Unknown pipe type: <script>unknown</script>', selections: [] }],
    }));
  });

  it('restores inputs and config and serializes successful outputs', async () => {
    await self.onmessage({
      data: {
        type: 'process',
        id: 2,
        pipeType: 'HexEncode',
        configs: { separator: ':', uppercase: false },
        inputs: { input: [10, 255], optional: null },
      },
    });
    expect(self.postMessage).toHaveBeenCalledWith({
      type: 'result',
      id: 2,
      outputs: { output: [...new TextEncoder().encode('0a:ff')] },
      errors: [],
      dynamicOutputPorts: null,
    });
  });

  it('returns pipe errors and dynamic output definitions', async () => {
    await self.onmessage({
      data: {
        type: 'process',
        id: 3,
        pipeType: 'UrlParser',
        configs: {},
        inputs: { input: [...new TextEncoder().encode('https://x.test/?a=1')] },
      },
    });
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: 3,
      errors: [],
      dynamicOutputPorts: [{ name: 'query:a', description: 'Query parameter: a' }],
    }));

    await self.onmessage({
      data: {
        type: 'process',
        id: 4,
        pipeType: 'HexDecode',
        inputs: { input: [...new TextEncoder().encode('abc')] },
      },
    });
    expect(self.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 4,
      errors: [{ message: 'Hex string has odd number of digits', selections: [] }],
    }));
  });
});
