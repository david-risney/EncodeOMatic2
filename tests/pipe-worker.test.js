import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtinPipes } from '../src/pipes/builtin/index.js';

let workerModule;

describe('pipe worker message handler', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('postMessage', vi.fn());
    workerModule = await import('../src/worker/pipe-worker.js');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('registers every worker-capable builtin type', () => {
    expect([...workerModule.workerRegistry.keys()]).toEqual(
      builtinPipes
        .filter((PipeClass) => PipeClass.supportsWorker !== false)
        .map(({ typeName }) => typeName)
    );
  });

  it('ignores unrelated messages and rejects unknown pipe types', async () => {
    await self.onmessage({ data: { type: 'other' } });
    expect(self.postMessage).not.toHaveBeenCalled();
    await self.onmessage({
      data: { type: 'process', id: 1, pipeType: '<script>unknown</script>' },
    });
    expect(self.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        id: 1,
        outputs: {},
        errors: [{ message: 'Unknown pipe type: <script>unknown</script>', selections: [] }],
      }),
      [],
    );
  });

  it('restores inputs and config and serializes successful outputs as transferable ArrayBuffers', async () => {
    await self.onmessage({
      data: {
        type: 'process',
        id: 2,
        pipeType: 'HexEncode',
        configs: { separator: ':', uppercase: false },
        inputs: { input: [10, 255], optional: null },
      },
    });
    const [msg, transferList] = self.postMessage.mock.calls.at(-1);
    expect(msg.type).toBe('result');
    expect(msg.id).toBe(2);
    expect(msg.errors).toEqual([]);
    expect(msg.dynamicOutputPorts).toBeNull();
    // Verify the output is a transferable ArrayBuffer with the correct bytes.
    // We use new Uint8Array() rather than instanceof because the buffer may
    // originate from a different VM realm (e.g. TextEncoder output in jsdom).
    expect([...new Uint8Array(msg.outputs.output)]).toEqual([...new TextEncoder().encode('0a:ff')]);
    expect(transferList).toHaveLength(1);
    expect(transferList[0]).toBe(msg.outputs.output);
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
    expect(self.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 3,
        errors: [],
        dynamicOutputPorts: [{ name: 'query:a', description: 'Query parameter: a' }],
      }),
      expect.any(Array),
    );

    await self.onmessage({
      data: {
        type: 'process',
        id: 4,
        pipeType: 'HexDecode',
        inputs: { input: [...new TextEncoder().encode('abc')] },
      },
    });
    expect(self.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 4,
        errors: [{
          message: 'Hex string has odd number of digits',
          selections: [{ index: 2, length: 1 }],
        }],
      }),
      expect.any(Array),
    );
  });

  it('processes file input pipes through the worker registry', async () => {
    await self.onmessage({
      data: {
        type: 'process',
        id: 5,
        pipeType: 'FileInputPipe',
        configs: { fileData: 'AQID' },
        inputs: {},
      },
    });
    const [msg, transferList] = self.postMessage.mock.calls.at(-1);
    expect(msg.type).toBe('result');
    expect(msg.id).toBe(5);
    expect([...new Uint8Array(msg.outputs.output)]).toEqual([1, 2, 3]);
    expect(msg.errors).toEqual([]);
    expect(msg.dynamicOutputPorts).toBeNull();
    expect(transferList).toHaveLength(1);
  });
});
