/**
 * HTTP Request Parser pipe.
 *
 * Parses a raw HTTP/1.1 request into method, path, version, headers, and body.
 */

import { Pipe, PipeError, PortDef } from '../../pipe.js';

const STATIC_OUTPUTS = [
  new PortDef('method', 'HTTP request method', true),
  new PortDef('path', 'Request path'),
  new PortDef('version', 'HTTP version'),
  new PortDef('body', 'Request body bytes'),
];

const REQUEST_PREFIXES = ['GET ', 'POST ', 'PUT ', 'DELETE ', 'PATCH ', 'HEAD ', 'OPTIONS '];

function findHeaderBodySeparator(data) {
  for (let i = 0; i < data.length - 3; i++) {
    if (data[i] === 0x0d && data[i + 1] === 0x0a && data[i + 2] === 0x0d && data[i + 3] === 0x0a) {
      return { headerEnd: i, bodyStart: i + 4 };
    }
  }
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0x0a && data[i + 1] === 0x0a) {
      return { headerEnd: i, bodyStart: i + 2 };
    }
  }
  return null;
}

export class HttpRequestParserPipe extends Pipe {
  static typeName = 'HttpRequestParser';
  static typeDescription = 'HTTP Request Parse';
  static category = 'Parsing';
  static categoryDescription = 'Parse a raw HTTP/1.1 request into its components.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    const prefix = String.fromCharCode(...input.slice(0, 8));
    return REQUEST_PREFIXES.some(method => prefix.startsWith(method)) ? 10 : 0;
  }

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineOutputs() {
    return [...STATIC_OUTPUTS, ...(this._dynamicOutputs ?? [])];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const split = findHeaderBodySeparator(data);
    if (!split) {
      throw new PipeError('Invalid HTTP request: no header/body separator');
    }

    const headersSection = new TextDecoder('utf-8', { fatal: false }).decode(data.slice(0, split.headerEnd));
    const body = data.slice(split.bodyStart);
    const lines = headersSection.split(/\r?\n/);
    const requestLine = lines[0] ?? '';
    const reqMatch = requestLine.match(/^([A-Z]+) (.+) (HTTP\/[\d.]+)$/);
    if (!reqMatch) {
      throw new PipeError(`Invalid HTTP request line: ${requestLine.slice(0, 100)}`);
    }

    const [, method, path, version] = reqMatch;
    const enc = new TextEncoder();
    const result = new Map();

    result.set('method', enc.encode(method));
    result.set('path', enc.encode(path));
    result.set('version', enc.encode(version));
    result.set('body', body);

    const headerValues = new Map();
    for (let index = 1; index < lines.length; index++) {
      const line = lines[index];
      if (!line.trim()) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const name = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      if (headerValues.has(name)) {
        headerValues.get(name).push(value);
      } else {
        headerValues.set(name, [value]);
      }
    }

    this._dynamicOutputs = [];
    for (const [name, values] of headerValues) {
      const portName = `header:${name}`;
      this._dynamicOutputs.push(new PortDef(portName, `Header: ${name}`));
      if (!this._outputData.has(portName)) {
        this._outputData.set(portName, null);
      }
      result.set(portName, enc.encode(values.join('\n')));
    }

    return result;
  }
}
