/**
 * Regex Match pipe.
 *
 * Applies a regex to the input string and produces:
 *   - match (default): the full match
 *   - group:1, group:2, ...: capture groups
 *   - all-matches: all matches joined by newlines
 */

import { Pipe, PipeConfig, PortDef, PipeError } from '../../pipe.js';

export class RegexMatchPipe extends Pipe {
  static typeName = 'RegexMatch';
  static typeDescription = 'Regex Match';
  static category = 'Parsing';
  static categoryDescription = 'Match a regular expression against the input.';

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineOutputs() {
    return [
      new PortDef('match',       'First match (or empty)',       true),
      new PortDef('all-matches', 'All matches, newline-separated'),
      ...(this._dynamicOutputs ?? []),
    ];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'pattern',
        description: 'Regular expression pattern',
        defaultValue: '.*',
        type: 'string',
      }),
      new PipeConfig({
        name: 'flags',
        description: 'Regex flags (g, i, m, s, u, d)',
        defaultValue: 'g',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder('utf-8').decode(data);
    const pattern = this.getConfig('pattern')?.value ?? '.*';
    const rawFlags = this.getConfig('flags')?.value ?? 'g';

    // Sanitize flags: keep only valid regex flag characters, deduplicate, ensure 'g'
    const validFlagChars = new Set('gimsud');
    const flagSet = new Set([...rawFlags].filter(c => validFlagChars.has(c)));
    flagSet.add('g'); // matchAll requires global flag
    const flags = [...flagSet].join('');

    let regex;
    try {
      regex = new RegExp(pattern, flags);
    } catch (e) {
      throw new PipeError(`Invalid regex: ${e.message}`);
    }

    const matches = [...text.matchAll(regex)];
    const enc = new TextEncoder();
    const result = new Map();

    if (matches.length === 0) {
      result.set('match', new Uint8Array(0));
      result.set('all-matches', new Uint8Array(0));
      this._dynamicOutputs = [];
      return result;
    }

    const first = matches[0];
    result.set('match', enc.encode(first[0]));
    result.set('all-matches', enc.encode(matches.map(m => m[0]).join('\n')));

    // Capture groups from first match
    this._dynamicOutputs = [];
    for (let i = 1; i < first.length; i++) {
      const portName = `group:${i}`;
      this._dynamicOutputs.push(new PortDef(portName, `Capture group ${i}`));
      if (!this._outputData.has(portName)) this._outputData.set(portName, null);
      result.set(portName, enc.encode(first[i] ?? ''));
    }

    return result;
  }
}
