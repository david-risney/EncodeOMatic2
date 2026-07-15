/**
 * Core pipe data model.
 *
 * A Pipe takes bytes as input and produces bytes as output.
 * Pipes have named input and output ports (one default each).
 * Pipes have typed configuration values.
 * Pipes can report errors with optional selection ranges.
 */

/** Configuration parameter for a pipe. */
export class PipeConfig {
  /**
   * @param {object} opts
   * @param {string} opts.name - Internal identifier
   * @param {string} opts.description - Human-readable description
   * @param {*} opts.defaultValue - Default value (used as initial value)
   * @param {'string'|'number'|'boolean'|'select'} opts.type - Value type
   * @param {string[]} [opts.options] - Options for 'select' type
   */
  constructor({ name, description, defaultValue, type, options = null }) {
    this.name = name;
    this.description = description;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
    this.type = type;
    this.options = options;
  }

  toJSON() {
    return { name: this.name, value: this.value };
  }
}

/** Error produced by a pipe during processing. */
export class PipeError {
  /**
   * @param {string} message
   * @param {{index: number, length: number}[]} [selections]
   */
  constructor(message, selections = []) {
    this.message = message;
    this.selections = selections;
  }
}

/** Definition of an input or output port. */
export class PortDef {
  /**
   * @param {string} name
   * @param {string} description
   * @param {boolean} [isDefault]
   */
  constructor(name, description, isDefault = false) {
    this.name = name;
    this.description = description;
    this.isDefault = isDefault;
  }
}

let _nextId = 1;

/**
 * Abstract base class for all pipes.
 *
 * Subclasses must implement:
 *   - defineInputs()  → PortDef[]
 *   - defineOutputs() → PortDef[]
 *   - defineConfigs() → PipeConfig[]
 *   - process(inputs: Map<string, Uint8Array>) → Promise<Map<string, Uint8Array>>
 *
 * Subclasses should set a static `typeName` and `typeDescription`.
 */
export class Pipe {
  /**
   * Rate how appropriate the supplied bytes are as input for this pipe.
   * Subclasses may return a score from -10 (definitely inappropriate) to
   * 10 (definitely appropriate); 0 means indeterminate.
   * @param {Uint8Array|null} input
   * @returns {number}
   */
  static getInputAppropriateness(input) {
    return 0;
  }

  constructor() {
    this.id = `pipe-${_nextId++}`;
    this.position = { x: 0, y: 0 };
    this.selection = []; // [{index, length}]

    this._configs = new Map();
    this._errors = [];
    this._inputData = new Map();
    this._outputData = new Map();

    // Build configs from subclass definition
    for (const cfg of this.defineConfigs()) {
      this._configs.set(cfg.name, cfg);
    }

    // Initialize port data maps
    for (const port of this.defineInputs()) {
      this._inputData.set(port.name, null);
    }
    for (const port of this.defineOutputs()) {
      this._outputData.set(port.name, null);
    }
  }

  /** @returns {string} */
  get displayName() {
    return this.constructor.typeDescription || this.constructor.typeName || this.constructor.name;
  }

  /** @returns {string} */
  get typeName() {
    return this.constructor.typeName;
  }

  /** @returns {PortDef[]} */
  defineInputs() {
    return [new PortDef('input', 'Input bytes', true)];
  }

  /** @returns {PortDef[]} */
  defineOutputs() {
    return [new PortDef('output', 'Output bytes', true)];
  }

  /** @returns {PipeConfig[]} */
  defineConfigs() {
    return [];
  }

  /** @returns {Map<string, PipeConfig>} */
  get configs() { return this._configs; }

  /** @returns {PipeError[]} */
  get errors() { return this._errors; }

  /** @param {string} name @returns {PipeConfig|undefined} */
  getConfig(name) { return this._configs.get(name); }

  /** @param {string} name @param {*} value */
  setConfig(name, value) {
    const cfg = this._configs.get(name);
    if (cfg) cfg.value = value;
  }

  /** @param {string} [portName] @returns {Uint8Array|null} */
  getInputData(portName) {
    portName = portName ?? this.defaultInputName;
    return this._inputData.get(portName) ?? null;
  }

  /** @param {string} portName @param {Uint8Array|null} data */
  setInputData(portName, data) {
    this._inputData.set(portName, data);
  }

  /** @param {string} [portName] @returns {Uint8Array|null} */
  getOutputData(portName) {
    portName = portName ?? this.defaultOutputName;
    return this._outputData.get(portName) ?? null;
  }

  /** @returns {string} */
  get defaultInputName() {
    const defs = this.defineInputs();
    return (defs.find(p => p.isDefault) ?? defs[0])?.name ?? 'input';
  }

  /** @returns {string} */
  get defaultOutputName() {
    const defs = this.defineOutputs();
    return (defs.find(p => p.isDefault) ?? defs[0])?.name ?? 'output';
  }

  /**
   * Process input data and return output data.
   * @param {Map<string, Uint8Array|null>} inputs
   * @returns {Promise<Map<string, Uint8Array>>}
   * @throws {PipeError}
   */
  async process(inputs) {
    throw new Error(`${this.constructor.name}.process() not implemented`);
  }

  /**
   * Run the pipe using its current _inputData.
   * Updates _outputData and _errors.
   */
  async run() {
    this._errors = [];
    // Clear outputs
    for (const key of this._outputData.keys()) {
      this._outputData.set(key, null);
    }

    try {
      const result = await this.process(this._inputData);
      for (const [name, data] of result) {
        if (this._outputData.has(name)) {
          this._outputData.set(name, data);
        }
      }
    } catch (e) {
      const err = (e instanceof PipeError) ? e : new PipeError(e.message ?? String(e));
      this._errors.push(err);
    }
  }

  /** Serialize to plain object. */
  toJSON() {
    const configs = {};
    for (const [name, cfg] of this._configs) {
      configs[name] = cfg.value;
    }
    return {
      id: this.id,
      type: this.constructor.typeName,
      configs,
      position: { ...this.position },
    };
  }

  /** Restore config values from a plain object. */
  fromJSON(data) {
    if (data.id) this.id = data.id;
    if (data.position) this.position = { ...data.position };
    if (data.configs) {
      for (const [name, value] of Object.entries(data.configs)) {
        this.setConfig(name, value);
      }
    }
  }
}
