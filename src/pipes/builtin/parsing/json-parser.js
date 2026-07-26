/**
 * JSON Parser pipe.
 *
 * Parses JSON and exposes the raw stringified value plus
 * top-level keys as named output ports. When the `paths` config is set,
 * only the specified JSON path expressions are exposed instead.
 */

import { Pipe, PortDef, PipeConfig, PipeError } from '../../pipe.js';

/**
 * Resolve a simple dot/bracket JSON path against a parsed value.
 * Supports: `a.b`, `a[0]`, `a[0].b`, `a.b[1].c`, etc.
 * Returns `undefined` when any segment is missing.
 * @param {*} root
 * @param {string} path
 * @returns {*}
 */
function resolveJsonPath(root, path) {
  // Tokenise the path into property names and array indices.
  // e.g. "a.b[0].c" → ["a", "b", "0", "c"]
  const segments = [];
  const re = /([^.[]+)|\[(\d+)\]/g;
  let match;
  while ((match = re.exec(path)) !== null) {
    segments.push(match[1] ?? match[2]);
  }

  let current = root;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[seg];
  }
  return current;
}

export class JsonParserPipe extends Pipe {
  static typeName = 'JsonParser';
  static typeDescription = 'JSON Parser';
  static category = 'Data Formats';
  static categoryDescription = 'Parse JSON and expose top-level keys as separate outputs.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    try {
      JSON.parse(text);
      return 10;
    } catch {
      return -10;
    }
  }

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

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'paths',
        description: 'Comma-delimited JSON paths to expose as outputs (e.g. a.b,c[0].d). Leave empty to expose all top-level keys.',
        defaultValue: '',
        type: 'string',
      }),
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

    const rawPaths = (this.getConfig('paths')?.value ?? '').trim();

    if (rawPaths) {
      // Expose only the configured paths as outputs.
      this._dynamicOutputs = [];
      for (const rawPath of rawPaths.split(',')) {
        const path = rawPath.trim();
        if (!path) continue;
        const portName = `path:${path}`;
        this._dynamicOutputs.push(new PortDef(portName, `JSON path: ${path}`));
        if (!this._outputData.has(portName)) {
          this._outputData.set(portName, null);
        }
        const value = resolveJsonPath(parsed, path);
        const serialized = value === undefined
          ? ''
          : typeof value === 'string' ? value : JSON.stringify(value);
        result.set(portName, enc.encode(serialized));
      }
    } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Default: expose all top-level keys.
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

export const builtinPipes = [JsonParserPipe];
