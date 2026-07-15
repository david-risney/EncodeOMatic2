/**
 * URL Parser pipe.
 *
 * Parses a URL string and exposes each part as a separate named output port.
 * Dynamic query parameters are exposed as additional outputs named "query:NAME".
 *
 * Outputs:
 *   - href (default)     full normalized URL
 *   - protocol           e.g. "https:"
 *   - hostname           e.g. "example.com"
 *   - port               e.g. "8080" (empty if default)
 *   - pathname           e.g. "/path/to/page"
 *   - search             e.g. "?foo=bar"
 *   - hash               e.g. "#section"
 *   - origin             e.g. "https://example.com"
 *   - query:NAME         individual query parameter values (one per param)
 */

import { Pipe, PortDef, PipeError } from '../../pipe.js';

const STATIC_OUTPUTS = [
  new PortDef('href',     'Full normalized URL',     true),
  new PortDef('protocol', 'URL protocol (scheme)'),
  new PortDef('hostname', 'Host name'),
  new PortDef('port',     'Port number'),
  new PortDef('pathname', 'URL path'),
  new PortDef('search',   'Query string (with ?)'),
  new PortDef('hash',     'Fragment (with #)'),
  new PortDef('origin',   'Origin (scheme + host + port)'),
];

const STATIC_OUTPUT_NAMES = new Set(STATIC_OUTPUTS.map(p => p.name));

export class UrlParserPipe extends Pipe {
  static typeName = 'UrlParser';
  static typeDescription = 'URL Parser';
  static category = 'Parsing';
  static categoryDescription = 'Parse a URL into its component parts.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let url;
    try {
      url = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (url.length === 0) return 0;
    try {
      new URL(url);
      return 10;
    } catch {
      return -10;
    }
  }

  constructor() {
    super();
    // Dynamic query parameter ports; rebuilt on each run
    this._dynamicOutputs = [];
  }

  defineOutputs() {
    return [...STATIC_OUTPUTS, ...(this._dynamicOutputs ?? [])];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const urlStr = new TextDecoder().decode(data).trim();

    let url;
    try {
      url = new URL(urlStr);
    } catch {
      throw new PipeError(`Invalid URL: "${urlStr.slice(0, 80)}"`);
    }

    const enc = new TextEncoder();
    const result = new Map();

    result.set('href',     enc.encode(url.href));
    result.set('protocol', enc.encode(url.protocol));
    result.set('hostname', enc.encode(url.hostname));
    result.set('port',     enc.encode(url.port));
    result.set('pathname', enc.encode(url.pathname));
    result.set('search',   enc.encode(url.search));
    result.set('hash',     enc.encode(url.hash));
    result.set('origin',   enc.encode(url.origin));

    // Rebuild dynamic outputs for query params
    this._dynamicOutputs = [];
    for (const [key, value] of url.searchParams) {
      const portName = `query:${key}`;
      this._dynamicOutputs.push(new PortDef(portName, `Query parameter: ${key}`));
      result.set(portName, enc.encode(value));
    }

    // Ensure output map has all dynamic ports
    for (const port of this._dynamicOutputs) {
      if (!this._outputData.has(port.name)) {
        this._outputData.set(port.name, null);
      }
    }

    return result;
  }
}
