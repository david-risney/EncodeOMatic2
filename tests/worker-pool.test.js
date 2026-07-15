import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerPool } from '../src/worker/worker-pool.js';

class FakeWorker {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
    FakeWorker.instances.push(this);
  }
}

describe('WorkerPool', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });

  it('creates module workers, serializes inputs, and resolves results', async () => {
    const pool = new WorkerPool('/worker.js', 1);
    const resultPromise = pool.run('HexEncode', { uppercase: true }, {
      input: Uint8Array.of(1, 2), optional: null,
    });
    const worker = FakeWorker.instances[0];
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'process',
      id: 1,
      pipeType: 'HexEncode',
      configs: { uppercase: true },
      inputs: { input: [1, 2], optional: null },
    });
    worker.onmessage({ data: {
      type: 'result',
      id: 1,
      outputs: { output: [65], empty: null },
      errors: [],
      dynamicOutputPorts: [{ name: 'x', description: 'X' }],
    } });
    const result = await resultPromise;
    expect([...result.outputs.get('output')]).toEqual([65]);
    expect(result.outputs.get('empty')).toBeNull();
    expect(result.dynamicOutputPorts).toHaveLength(1);
  });

  it('queues work and reuses an idle worker', async () => {
    const pool = new WorkerPool('/worker.js', 1);
    const first = pool.run('A', {}, {});
    const second = pool.run('B', {}, {});
    const worker = FakeWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    worker.onmessage({ data: { type: 'result', id: 1, outputs: {} } });
    await first;
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage.mock.calls[1][0].pipeType).toBe('B');
    worker.onmessage({ data: { type: 'result', id: 2, outputs: {} } });
    await second;
  });

  it('ignores unrelated messages and rejects worker failures', async () => {
    const pool = new WorkerPool('/worker.js', 1);
    const pending = pool.run('A', {}, {});
    const worker = FakeWorker.instances[0];
    worker.onmessage({ data: { type: 'progress', id: 1 } });
    worker.onmessage({ data: { type: 'result', id: 999 } });
    expect(pool._pending.size).toBe(1);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    worker.onerror({ message: 'boom' });
    await expect(pending).rejects.toThrow('Worker error: boom');
    expect(error).toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('replaces a failed worker to drain queued work', async () => {
    const pool = new WorkerPool('/worker.js', 1);
    const first = pool.run('A', {}, {});
    const second = pool.run('B', {}, {});
    FakeWorker.instances[0].onerror({ message: 'failure' });
    await expect(first).rejects.toThrow();
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].onmessage({
      data: { type: 'result', id: 2, outputs: { output: [1] } },
    });
    expect([...(await second).outputs.get('output')]).toEqual([1]);
  });

  it('terminates idle and busy workers', async () => {
    const pool = new WorkerPool('/worker.js', 2);
    pool.run('A', {}, {});
    pool.run('B', {}, {});
    const workers = [...FakeWorker.instances];
    pool.terminate();
    expect(workers.every((worker) => worker.terminate.mock.calls.length === 1)).toBe(true);
    expect(pool._idle).toEqual([]);
    expect(pool._busy.size).toBe(0);
  });
});
