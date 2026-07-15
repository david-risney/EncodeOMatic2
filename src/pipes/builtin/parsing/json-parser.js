/**
 * JSON Parser pipe.
 *
 * Parses JSON and exposes the raw stringified value plus
 * top-level keys as named output ports.
 */

import { Pipe, PortDef, PipeError } from '../../pipe.js';

export class JsonParserPipe extends Pipe {
  static typeName = 'JsonParser';
  static typeDescription = 'JSON Parser';
  static category = 'Parsing';
  static categoryDescription = 'Parse JSON and expose top-level keys as separate outputs.';

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineOutputs() {
    return [
      new PortDef('json', 'Pretty-printed JSON', true),
      ...(this._dynamicOutputs ?? []),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new PipeError(`Invalid JSON: ${e.message}`);
    }

    const enc = new TextEncoder();
    const result = new Map();
    result.set('json', enc.encode(JSON.stringify(parsed, null, 2)));

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      this._dynamicOutputs = [];
      for (const [key, value] of Object.entries(parsed)) {
        const portName = `key:${key}`;
        this._dynamicOutputs.push(new PortDef(portName, `JSON key: ${key}`));
        if (!this._outputData.has(portName)) {
          this._outputData.set(portName, null);
        }
        const v = typeof value === 'string' ? value : JSON.stringify(value);
        result.set(portName, enc.encode(v));
      }
    } else {
      this._dynamicOutputs = [];
    }

    return result;
  }
}
