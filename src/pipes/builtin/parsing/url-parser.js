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
 *
 * Input-appropriateness scoring:
 *   - Valid absolute URL with a well-known scheme (http, https, …): 10
 *   - Valid absolute URL with any other scheme:                       7
 *   - Parses only as a relative URL (no whitespace):                  3
 *   - Otherwise (invalid, whitespace, binary):                       -10
 *
 * Default output selection (computed after each process() call):
 *   - If the URL has query parameters with non-empty values, the output
 *     whose value is longest among those parameters is the default.
 *   - Otherwise, the output property whose encoded value is longest is
 *     the default.
 */

import { Pipe, PortDef, PipeError } from '../../pipe.js';

const STATIC_OUTPUTS = [
  new PortDef('href',     'Full normalized URL',     true),
  new PortDef('protocol', 'URL protocol (scheme)'),
  new PortDef('username', 'User name'),
  new PortDef('password', 'Password'),
  new PortDef('hostname', 'Host name'),
  new PortDef('port',     'Port number'),
  new PortDef('pathname', 'URL path'),
  new PortDef('search',   'Query string (with ?)'),
  new PortDef('hash',     'Fragment (with #)'),
  new PortDef('origin',   'Origin (scheme + host + port)'),
];

const STATIC_OUTPUT_NAMES = new Set(STATIC_OUTPUTS.map(p => p.name));

// Schemes that are universally recognized; input with one of these scores 10.
const WELL_KNOWN_SCHEMES = new Set([
  'http:', 'https:', 'ftp:', 'ftps:', 'ws:', 'wss:',
  'mailto:', 'file:', 'data:', 'blob:', 'tel:', 'urn:', 'about:',
]);

// Sentinel base used only to test whether a string parses as a relative URL.
const RELATIVE_URL_BASE = 'https://example.com/';

export class UrlParserPipe extends Pipe {
  static typeName = 'UrlParser';
  static typeDescription = 'URL Parser';
  static category = 'Web';
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
    // Whitespace anywhere in the (trimmed) string rules out a valid URL.
    if (/\s/.test(url)) return -10;
    // Try as an absolute URL first.
    try {
      const parsed = new URL(url);
      return WELL_KNOWN_SCHEMES.has(parsed.protocol) ? 10 : 7;
    } catch {
      // Fall through to relative-URL test.
    }
    // Try as a relative URL (requires a base to resolve against).
    try {
      new URL(url, RELATIVE_URL_BASE);
      return 3;
    } catch {
      return -10;
    }
  }

  constructor() {
    super();
    // Dynamic query parameter ports; rebuilt on each run
    this._dynamicOutputs = [];
    // Best default output name; updated by process()
    this._defaultOutputName = 'href';
  }

  /** @override */
  get defaultOutputName() {
    return this._defaultOutputName;
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
    result.set('username', enc.encode(url.username));
    result.set('password', enc.encode(url.password));
    result.set('hostname', enc.encode(url.hostname));
    result.set('port',     enc.encode(url.port));
    result.set('pathname', enc.encode(url.pathname));
    result.set('search',   enc.encode(url.search));
    result.set('hash',     enc.encode(url.hash));
    result.set('origin',   enc.encode(url.origin));

    // Rebuild dynamic outputs for query params
    const queryValues = new Map();
    for (const [key, value] of url.searchParams) {
      queryValues.set(key, value);
    }
    this._dynamicOutputs = [];
    for (const [key, value] of queryValues) {
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

    // Choose the default output for downstream chaining:
    //   1. Among query params that have a non-empty value, pick the longest.
    //   2. Otherwise, pick the output (including href) with the longest value.
    const queryWithValues = [...result.entries()]
      .filter(([k, v]) => k.startsWith('query:') && v.length > 0);
    if (queryWithValues.length > 0) {
      this._defaultOutputName = queryWithValues
        .reduce((a, b) => b[1].length > a[1].length ? b : a)[0];
    } else {
      this._defaultOutputName = [...result.entries()]
        .reduce((a, b) => b[1].length > a[1].length ? b : a)[0];
    }

    return result;
  }
}

export const builtinPipes = [UrlParserPipe];
