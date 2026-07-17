/**
 * Search Params Parser pipe.
 *
 * Parses a URL query string and exposes query parameter values
 * as dynamic output ports.
 */

import { Pipe, PortDef, PipeConfig } from '../../pipe.js';

export class SearchParamsParserPipe extends Pipe {
  static typeName = 'SearchParamsParser';
  static typeDescription = 'Search Params Parse';
  static category = 'Parsing';
  static categoryDescription = 'Parse a URL query string into key-value pairs.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;

    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }

    if (text.length === 0) return 0;
    if (text.includes('://')) return -5;
    return /^\??[^=&?#]+=/.test(text) ? 8 : 0;
  }

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineOutputs() {
    return [...(this._dynamicOutputs ?? [])];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'multiValue',
        description: 'How to handle duplicate keys',
        defaultValue: 'last',
        type: 'select',
        options: ['last', 'join'],
      }),
    ];
  }

  async process(inputs) {
    const raw = new TextDecoder().decode(inputs.get(this.defaultInputName) ?? new Uint8Array(0));
    const qs = raw.startsWith('?') ? raw.slice(1) : raw;
    const params = new URLSearchParams(qs);
    const multiValue = this.getConfig('multiValue')?.value ?? 'last';
    const enc = new TextEncoder();
    const result = new Map();
    this._dynamicOutputs = [];

    const keyValues = new Map();
    for (const [key, value] of params) {
      if (!keyValues.has(key)) keyValues.set(key, []);
      keyValues.get(key).push(value);
    }

    for (const [key, values] of keyValues) {
      const portName = `query:${key}`;
      this._dynamicOutputs.push(new PortDef(portName, `Query param: ${key}`));
      if (!this._outputData.has(portName)) this._outputData.set(portName, null);
      const value = multiValue === 'join' ? values.join('\n') : values[values.length - 1];
      result.set(portName, enc.encode(value));
    }

    return result;
  }
}
