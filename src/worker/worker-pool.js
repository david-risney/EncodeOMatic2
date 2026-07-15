/**
 * WorkerPool — manages a pool of pipe-worker.js Web Workers
 * for concurrent pipe processing.
 *
 * The pool lazily creates workers up to `maxWorkers`.
 * Tasks are queued if all workers are busy.
 */

const DEFAULT_MAX_WORKERS = Math.max(2, navigator.hardwareConcurrency ?? 4);

export class WorkerPool {
  /**
   * @param {string} workerUrl - URL to the pipe-worker.js module
   * @param {number} [maxWorkers]
   */
  constructor(workerUrl, maxWorkers = DEFAULT_MAX_WORKERS) {
    this._workerUrl = workerUrl;
    this._maxWorkers = maxWorkers;
    this._idle = [];      // idle Worker instances
    this._busy = new Set(); // busy Worker instances
    this._queue = [];       // pending tasks
    this._msgId = 0;
    // Map from msgId → {resolve, reject, worker}
    this._pending = new Map();
  }

  /**
   * Run a pipe processing task in a worker.
   *
   * @param {string} pipeType
   * @param {object} configs  - {name: value}
   * @param {object} inputs   - {portName: Uint8Array|null}
   * @returns {Promise<{outputs: Map<string, Uint8Array>, errors: object[]}>}
   */
  run(pipeType, configs, inputs) {
    return new Promise((resolve, reject) => {
      const id = ++this._msgId;
      // Serialize inputs
      const serializedInputs = {};
      for (const [k, v] of Object.entries(inputs)) {
        serializedInputs[k] = v instanceof Uint8Array ? [...v] : v;
      }
      const task = { id, pipeType, configs, inputs: serializedInputs, resolve, reject };
      this._enqueue(task);
    });
  }

  _enqueue(task) {
    const worker = this._getIdleWorker();
    if (worker) {
      this._dispatch(worker, task);
    } else if (this._idle.length + this._busy.size < this._maxWorkers) {
      const newWorker = this._createWorker();
      this._dispatch(newWorker, task);
    } else {
      this._queue.push(task);
    }
  }

  _getIdleWorker() {
    return this._idle.pop() ?? null;
  }

  _createWorker() {
    const worker = new Worker(this._workerUrl, { type: 'module' });
    worker.onmessage = ({ data }) => this._onMessage(worker, data);
    worker.onerror = (e) => this._onError(worker, e);
    return worker;
  }

  _dispatch(worker, task) {
    this._busy.add(worker);
    this._pending.set(task.id, { resolve: task.resolve, reject: task.reject, worker });

    worker.postMessage({
      type: 'process',
      id: task.id,
      pipeType: task.pipeType,
      configs: task.configs,
      inputs: task.inputs,
    });
  }

  _onMessage(worker, data) {
    if (data.type !== 'result') return;
    const pending = this._pending.get(data.id);
    if (!pending) return;
    this._pending.delete(data.id);
    this._busy.delete(worker);
    this._idle.push(worker);

    // Deserialize outputs (plain arrays → Uint8Array)
    const outputs = new Map();
    for (const [k, v] of Object.entries(data.outputs ?? {})) {
      outputs.set(k, v ? new Uint8Array(v) : null);
    }

    pending.resolve({
      outputs,
      errors: data.errors ?? [],
      dynamicOutputPorts: data.dynamicOutputPorts ?? null,
    });

    // Dispatch next queued task
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      // _getIdleWorker() pops the last idle worker (O(1)). If idle is unexpectedly
      // empty, fall back to the just-completed worker and remove it from idle first.
      const nextWorker = this._getIdleWorker();
      if (nextWorker) {
        this._dispatch(nextWorker, next);
      } else {
        // Fallback: reuse the completing worker directly (remove it from idle first)
        const idx = this._idle.lastIndexOf(worker);
        if (idx !== -1) this._idle.splice(idx, 1);
        this._dispatch(worker, next);
      }
    }
  }

  _onError(worker, e) {
    console.error('Worker error:', e);
    // Reject all pending tasks for this worker
    for (const [id, { reject, worker: w }] of this._pending) {
      if (w === worker) {
        this._pending.delete(id);
        reject(new Error('Worker error: ' + (e.message ?? 'unknown')));
      }
    }
    this._busy.delete(worker);
    // Replace this worker
    worker.terminate();
    // Drain queue if possible
    if (this._queue.length > 0) {
      const newW = this._createWorker();
      const next = this._queue.shift();
      this._dispatch(newW, next);
    }
  }

  /** Terminate all workers immediately. */
  terminate() {
    for (const w of [...this._idle, ...this._busy]) {
      w.terminate();
    }
    this._idle = [];
    this._busy.clear();
  }
}
