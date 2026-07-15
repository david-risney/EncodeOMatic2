/**
 * PipeGraph — manages a directed graph of pipes and their connections.
 *
 * Connections flow from an output port of one pipe to an input port of another.
 * One output port can feed multiple input ports.
 * The graph processes pipes in topological order when the graph is executed.
 */

import { Pipe, PortDef, PipeError } from './pipe.js';

/** Represents a directional connection between two pipe ports. */
export class Connection {
  /**
   * @param {string} fromPipeId
   * @param {string} fromOutput - output port name
   * @param {string} toPipeId
   * @param {string} toInput - input port name
   */
  constructor(fromPipeId, fromOutput, toPipeId, toInput) {
    this.id = `conn-${fromPipeId}:${fromOutput}->${toPipeId}:${toInput}`;
    this.fromPipeId = fromPipeId;
    this.fromOutput = fromOutput;
    this.toPipeId = toPipeId;
    this.toInput = toInput;
  }

  toJSON() {
    return {
      fromPipeId: this.fromPipeId,
      fromOutput: this.fromOutput,
      toPipeId: this.toPipeId,
      toInput: this.toInput,
    };
  }
}

/**
 * The main pipe graph.
 *
 * Maintains pipes and connections, propagates data, and supports
 * serialization/deserialization.
 */
export class PipeGraph {
  constructor() {
    /** @type {Map<string, Pipe>} */
    this.pipes = new Map();
    /** @type {Connection[]} */
    this.connections = [];
    /** @type {Set<Function>} */
    this._listeners = new Set();
    this._processingScheduled = false;
    /**
     * Optional worker pool for async processing.
     * When set, pipe processing runs in worker threads.
     * @type {import('../worker/worker-pool.js').WorkerPool|null}
     */
    this._workerPool = null;
  }

  /**
   * Set the worker pool to use for pipe processing.
   * @param {import('../worker/worker-pool.js').WorkerPool} pool
   */
  setWorkerPool(pool) {
    this._workerPool = pool;
  }

  // ── Mutation ────────────────────────────────────────────────

  /** @param {Pipe} pipe */
  addPipe(pipe) {
    this.pipes.set(pipe.id, pipe);
    this._notify({ type: 'pipe-added', pipeId: pipe.id });
  }

  /** @param {string} pipeId */
  removePipe(pipeId) {
    // Remove all connections involving this pipe
    this.connections = this.connections.filter(
      c => c.fromPipeId !== pipeId && c.toPipeId !== pipeId
    );
    this.pipes.delete(pipeId);
    this._notify({ type: 'pipe-removed', pipeId });
  }

  /**
   * Connect an output port of one pipe to an input port of another.
   * @param {string} fromPipeId
   * @param {string} fromOutput
   * @param {string} toPipeId
   * @param {string} toInput
   * @returns {Connection|null}
   */
  connect(fromPipeId, fromOutput, toPipeId, toInput) {
    // Don't allow cycles or duplicate connections
    if (fromPipeId === toPipeId) return null;
    const existing = this.connections.find(
      c => c.toPipeId === toPipeId && c.toInput === toInput
    );
    if (existing) {
      // Replace existing connection to this input
      this.disconnect(existing.fromPipeId, existing.fromOutput, toPipeId, toInput);
    }
    if (this._wouldCycle(fromPipeId, toPipeId)) return null;

    const conn = new Connection(fromPipeId, fromOutput, toPipeId, toInput);
    this.connections.push(conn);
    this._notify({ type: 'connection-added', connection: conn });
    return conn;
  }

  /**
   * @param {string} fromPipeId
   * @param {string} fromOutput
   * @param {string} toPipeId
   * @param {string} toInput
   */
  disconnect(fromPipeId, fromOutput, toPipeId, toInput) {
    const before = this.connections.length;
    this.connections = this.connections.filter(
      c => !(c.fromPipeId === fromPipeId && c.fromOutput === fromOutput &&
             c.toPipeId === toPipeId && c.toInput === toInput)
    );
    if (this.connections.length < before) {
      this._notify({ type: 'connection-removed', fromPipeId, fromOutput, toPipeId, toInput });
    }
  }

  /** Remove a connection by its id. */
  disconnectById(connId) {
    const conn = this.connections.find(c => c.id === connId);
    if (conn) {
      this.disconnect(conn.fromPipeId, conn.fromOutput, conn.toPipeId, conn.toInput);
    }
  }

  // ── Processing ──────────────────────────────────────────────

  /**
   * Process the entire graph in topological order starting from all source pipes.
   * @returns {Promise<void>}
   */
  async processAll() {
    const order = this._topologicalOrder();
    for (const pipeId of order) {
      await this._runPipe(pipeId);
    }
    this._notify({ type: 'processed' });
  }

  /**
   * Process starting from a specific pipe and all downstream pipes.
   * @param {string} pipeId
   */
  async processFrom(pipeId) {
    const downstream = this._downstreamFrom(pipeId);
    for (const id of downstream) {
      await this._runPipe(id);
    }
    this._notify({ type: 'processed' });
  }

  /** @param {string} pipeId */
  async _runPipe(pipeId) {
    const pipe = this.pipes.get(pipeId);
    if (!pipe) return;

    // Feed connected inputs
    for (const conn of this.connections) {
      if (conn.toPipeId === pipeId) {
        const fromPipe = this.pipes.get(conn.fromPipeId);
        if (fromPipe) {
          const data = fromPipe.getOutputData(conn.fromOutput);
          pipe.setInputData(conn.toInput, data);
        }
      }
    }

    if (this._workerPool && pipe.constructor.typeName) {
      await this._runPipeInWorker(pipe);
    } else {
      await pipe.run();
    }
    this._notify({ type: 'pipe-processed', pipeId });
  }

  /** Run a pipe using the worker pool. */
  async _runPipeInWorker(pipe) {
    const configs = {};
    for (const [name, cfg] of pipe._configs) {
      configs[name] = cfg.value;
    }

    const inputs = {};
    for (const [name, data] of pipe._inputData) {
      inputs[name] = data;
    }

    let result;
    try {
      result = await this._workerPool.run(pipe.constructor.typeName, configs, inputs);
    } catch (e) {
      pipe._errors = [new PipeError(e.message ?? String(e))];
      for (const key of pipe._outputData.keys()) pipe._outputData.set(key, null);
      return;
    }

    const { outputs, errors, dynamicOutputPorts } = result;

    // Update errors
    pipe._errors = (errors ?? []).map(e => new PipeError(e.message, e.selections));

    // Update dynamic outputs if pipe supports them
    if (dynamicOutputPorts && '_dynamicOutputs' in pipe) {
      pipe._dynamicOutputs = dynamicOutputPorts.map(p => new PortDef(p.name, p.description));
      // Ensure new dynamic ports exist in _outputData
      for (const port of pipe._dynamicOutputs) {
        if (!pipe._outputData.has(port.name)) {
          pipe._outputData.set(port.name, null);
        }
      }
    }

    // Update output data for all returned ports (including dynamic ones)
    for (const [portName, data] of outputs) {
      pipe._outputData.set(portName, data);
    }
  }

  // ── Graph utilities ─────────────────────────────────────────

  /** Topological sort of pipe IDs. */
  _topologicalOrder() {
    const visited = new Set();
    const result = [];

    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      // Visit all upstream pipes first
      for (const conn of this.connections) {
        if (conn.toPipeId === id) {
          visit(conn.fromPipeId);
        }
      }
      result.push(id);
    };

    for (const id of this.pipes.keys()) {
      visit(id);
    }

    return result;
  }

  /** Get pipe IDs in downstream order starting from startId. */
  _downstreamFrom(startId) {
    const result = [];
    const visited = new Set();

    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      result.push(id);
      for (const conn of this.connections) {
        if (conn.fromPipeId === id) {
          visit(conn.toPipeId);
        }
      }
    };

    visit(startId);
    return result;
  }

  /** Check if connecting fromId → toId would create a cycle. */
  _wouldCycle(fromId, toId) {
    // DFS: can we reach fromId from toId?
    const visited = new Set();
    const check = (id) => {
      if (id === fromId) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      for (const conn of this.connections) {
        if (conn.fromPipeId === id) {
          if (check(conn.toPipeId)) return true;
        }
      }
      return false;
    };
    return check(toId);
  }

  /**
   * Get connections where this pipe is the source (by output port).
   * @param {string} pipeId
   * @param {string} [outputPort]
   * @returns {Connection[]}
   */
  getOutgoingConnections(pipeId, outputPort) {
    return this.connections.filter(
      c => c.fromPipeId === pipeId && (outputPort == null || c.fromOutput === outputPort)
    );
  }

  /**
   * Get the connection feeding this pipe's input port.
   * @param {string} pipeId
   * @param {string} inputPort
   * @returns {Connection|null}
   */
  getIncomingConnection(pipeId, inputPort) {
    return this.connections.find(
      c => c.toPipeId === pipeId && c.toInput === inputPort
    ) ?? null;
  }

  /**
   * Get the "last" pipe added (for auto-connect).
   * Returns the pipe with the highest pipe-N id that has no outgoing connections.
   * @returns {Pipe|null}
   */
  getLastPipe() {
    const pipeIds = [...this.pipes.keys()];
    // Find pipes with no outgoing default connections
    const sinks = pipeIds.filter(id => {
      const pipe = this.pipes.get(id);
      const outName = pipe.defaultOutputName;
      return !this.connections.some(c => c.fromPipeId === id && c.fromOutput === outName);
    });
    // Return the most recently added one (highest numeric suffix)
    const sorted = sinks.sort((a, b) => {
      const na = parseInt(a.replace('pipe-', '')) || 0;
      const nb = parseInt(b.replace('pipe-', '')) || 0;
      return nb - na;
    });
    return sorted.length > 0 ? this.pipes.get(sorted[0]) : null;
  }

  // ── Serialization ───────────────────────────────────────────

  /** Serialize graph to a plain object. */
  toJSON() {
    return {
      pipes: [...this.pipes.values()].map(p => p.toJSON()),
      connections: this.connections.map(c => c.toJSON()),
    };
  }

  /**
   * Restore graph from a plain object.
   * @param {object} data
   * @param {Map<string, typeof Pipe>} registry - Map of typeName → Pipe class
   */
  fromJSON(data, registry) {
    this.pipes.clear();
    this.connections = [];

    for (const pipeData of data.pipes ?? []) {
      const PipeClass = registry.get(pipeData.type);
      if (!PipeClass) {
        console.warn(`Unknown pipe type: ${pipeData.type}`);
        continue;
      }
      const pipe = new PipeClass();
      pipe.fromJSON(pipeData);
      this.pipes.set(pipe.id, pipe);
    }

    for (const connData of data.connections ?? []) {
      const conn = new Connection(
        connData.fromPipeId,
        connData.fromOutput,
        connData.toPipeId,
        connData.toInput
      );
      this.connections.push(conn);
    }
  }

  // ── Events ──────────────────────────────────────────────────

  /** @param {Function} listener */
  addListener(listener) { this._listeners.add(listener); }

  /** @param {Function} listener */
  removeListener(listener) { this._listeners.delete(listener); }

  /** @param {object} event */
  _notify(event) {
    for (const fn of this._listeners) {
      try { fn(event); } catch (e) { console.error(e); }
    }
  }
}
