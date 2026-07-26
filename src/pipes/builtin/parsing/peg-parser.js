/**
 * PEG Parser pipe (peggy / peg.js successor).
 *
 * Parses input text against a PEG grammar provided as a separate input.
 *
 * Inputs:
 *   - input (default)  — text bytes to parse
 *   - grammar          — PEG grammar text (peggy syntax)
 *
 * Configs:
 *   - startRule     — override the auto-detected start rule (first declared rule)
 *   - captureRules  — comma-separated rule names to try as alternate start rules
 *
 * Outputs:
 *   - valid (default)  — "true" or "false"
 *   - match            — matched text (empty on failure)
 *   - tree             — parse result as JSON
 *   - rule:NAME        — dynamic port: result of parsing from that rule
 */

import { Pipe, PortDef, PipeConfig, PipeError } from '../../pipe.js';
import peggy from '../../../../vendor/peggy.js';

export class PegParserPipe extends Pipe {
  static typeName = 'PegParser';
  static typeDescription = 'PEG Parser';
  static category = 'Grammar';
  static categoryDescription = 'Parse text against a PEG grammar (peggy syntax). Wire a grammar text to the grammar input.';

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineInputs() {
    return [
      new PortDef('input',   'Text to parse',              true),
      new PortDef('grammar', 'PEG grammar (peggy syntax)'),
    ];
  }

  defineOutputs() {
    return [
      new PortDef('valid', 'Whether input matches the grammar', true),
      new PortDef('match', 'Full matched text (empty if invalid)'),
      new PortDef('tree',  'Parse result as JSON'),
      ...(this._dynamicOutputs ?? []),
    ];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'startRule',
        description: 'Start rule name (auto-detects first rule if empty)',
        defaultValue: '',
        type: 'string',
      }),
      new PipeConfig({
        name: 'captureRules',
        description: 'Comma-separated rule names to try as additional start rules',
        defaultValue: '',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const enc = new TextEncoder();
    const dec = new TextDecoder('utf-8', { fatal: true });

    const grammarData = inputs.get('grammar') ?? new Uint8Array(0);
    const inputData  = inputs.get('input')   ?? new Uint8Array(0);

    if (!grammarData.length) throw new PipeError('Grammar input is empty');

    let grammarText, inputText;
    try { grammarText = dec.decode(grammarData).trim(); } catch { throw new PipeError('Grammar is not valid UTF-8'); }
    try { inputText  = dec.decode(inputData); } catch { throw new PipeError('Input is not valid UTF-8'); }

    // Resolve configs
    const startRuleConfig = (this.getConfig('startRule')?.value ?? '').trim();
    const captureConfig   = (this.getConfig('captureRules')?.value ?? '').trim();
    const captureNames    = captureConfig ? captureConfig.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Build allowed start rules: we need all capture rules + start rule available at compile time
    const allowedSet = new Set(captureNames);
    if (startRuleConfig) allowedSet.add(startRuleConfig);
    const allowedStartRules = allowedSet.size > 0 ? [...allowedSet, '*'] : ['*'];

    // Compile grammar
    let parser;
    try {
      parser = peggy.generate(grammarText, {
        output: 'parser',
        allowedStartRules,
      });
    } catch (e) {
      throw new PipeError(`PEG grammar error: ${e.message}`);
    }

    // Determine start rule: use config, or default parser start (first rule)
    let startRule = startRuleConfig || undefined; // undefined → parser uses its default

    // Parse from start rule
    let isValid = false;
    let treeResult = null;
    try {
      treeResult = parser.parse(inputText, startRule ? { startRule } : undefined);
      isValid = true;
    } catch { /* parse failed */ }

    const out = new Map();
    out.set('valid', enc.encode(isValid ? 'true' : 'false'));
    out.set('match', enc.encode(isValid ? inputText : ''));
    out.set('tree',  enc.encode(isValid ? JSON.stringify(treeResult, null, 2) : 'null'));

    // Capture rules: try parsing from each alternate rule
    this._dynamicOutputs = [];
    for (const capRule of captureNames) {
      const portName = `rule:${capRule}`;
      this._dynamicOutputs.push(new PortDef(portName, `Parse from rule: ${capRule}`));
      if (!this._outputData.has(portName)) this._outputData.set(portName, null);

      let capResult = '';
      try {
        const capTree = parser.parse(inputText, { startRule: capRule });
        capResult = JSON.stringify(capTree);
      } catch { /* no match */ }
      out.set(portName, enc.encode(capResult));
    }

    return out;
  }
}
