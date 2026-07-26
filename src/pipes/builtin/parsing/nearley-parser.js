/**
 * Nearley Parser pipe.
 *
 * Parses input text against a Nearley grammar provided as a separate input.
 * Nearley uses a BNF-like syntax with optional semantic actions.
 *
 * Inputs:
 *   - input (default)  — text bytes to parse
 *   - grammar          — Nearley grammar text
 *
 * Configs:
 *   - startRule     — override the auto-detected start rule (first declared rule)
 *   - captureRules  — comma-separated rule names to try as alternate start rules
 *
 * Outputs:
 *   - valid (default)  — "true" or "false"
 *   - match            — matched text (empty on failure)
 *   - tree             — first parse result as JSON
 *   - rule:NAME        — dynamic port: result of parsing from that rule
 */

import { Pipe, PortDef, PipeConfig, PipeError } from '../../pipe.js';
import { nearley, compile, generate, bootstrapped } from '../../../../vendor/nearley.js';

/**
 * Compile a Nearley grammar string into a grammar object.
 * @param {string} grammarText
 * @returns {{ grammar: object, ruleNames: string[] }}
 */
function compileNearleyGrammar(grammarText) {
  let parseResult;
  try {
    const metaParser = new nearley.Parser(nearley.Grammar.fromCompiled(bootstrapped));
    metaParser.feed(grammarText);
    if (metaParser.results.length === 0) throw new Error('Grammar produced no parse');
    parseResult = metaParser.results[0];
  } catch (e) {
    throw new PipeError(`Nearley grammar syntax error: ${e.message}`);
  }

  let compiled;
  try {
    compiled = compile(parseResult, {});
  } catch (e) {
    throw new PipeError(`Nearley grammar compile error: ${e.message}`);
  }

  const generated = generate(compiled, 'grammar');

  // Execute the generated code. The IIFE checks typeof module/window in its
  // closure, so we supply a module object as the outer parameter.
  const moduleObj = { exports: {} };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('module', generated);
    fn(moduleObj);
  } catch (e) {
    throw new PipeError(`Nearley grammar evaluation error: ${e.message}`);
  }

  const grammarObj = moduleObj.exports;
  if (!grammarObj || !grammarObj.ParserRules) {
    throw new PipeError('Nearley grammar produced no valid output');
  }

  const ruleNames = [...new Set(grammarObj.ParserRules.map(r => r.name.replace(/\$.*$/, '')))];
  return { grammarObj, ruleNames };
}

export class NearleyParserPipe extends Pipe {
  static typeName = 'NearleyParser';
  static typeDescription = 'Nearley Parser';
  static category = 'Grammar';
  static categoryDescription = 'Parse text against a Nearley BNF-like grammar. Wire a grammar text to the grammar input.';

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineInputs() {
    return [
      new PortDef('input',   'Text to parse',         true),
      new PortDef('grammar', 'Nearley grammar text'),
    ];
  }

  defineOutputs() {
    return [
      new PortDef('valid', 'Whether input matches the grammar', true),
      new PortDef('match', 'Full matched text (empty if invalid)'),
      new PortDef('tree',  'First parse result as JSON'),
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

    const { grammarObj, ruleNames } = compileNearleyGrammar(grammarText);

    // Resolve start rule
    const startRuleConfig = (this.getConfig('startRule')?.value ?? '').trim();
    let startRule;
    if (startRuleConfig) {
      if (!ruleNames.includes(startRuleConfig)) {
        throw new PipeError(`Start rule "${startRuleConfig}" not found in grammar`);
      }
      startRule = startRuleConfig;
    } else {
      startRule = grammarObj.ParserStart ?? ruleNames[0];
    }

    // Resolve capture rules
    const captureConfig = (this.getConfig('captureRules')?.value ?? '').trim();
    const captureNames  = captureConfig ? captureConfig.split(',').map(s => s.trim()).filter(Boolean) : [];
    for (const c of captureNames) {
      if (!ruleNames.includes(c)) throw new PipeError(`Capture rule "${c}" not found in grammar`);
    }

    // Parse from start rule
    let isValid = false;
    let firstResult = null;
    try {
      const activeGrammar = { ...grammarObj, ParserStart: startRule };
      const parser = new nearley.Parser(nearley.Grammar.fromCompiled(activeGrammar));
      parser.feed(inputText);
      isValid = parser.results.length > 0;
      firstResult = isValid ? parser.results[0] : null;
    } catch (e) {
      isValid = false;
    }

    const out = new Map();
    out.set('valid', enc.encode(isValid ? 'true' : 'false'));
    out.set('match', enc.encode(isValid ? inputText : ''));
    out.set('tree',  enc.encode(isValid ? JSON.stringify(firstResult, null, 2) : 'null'));

    // Capture rules: parse from each alternate start rule
    this._dynamicOutputs = [];
    for (const capRule of captureNames) {
      const portName = `rule:${capRule}`;
      this._dynamicOutputs.push(new PortDef(portName, `Parse from rule: ${capRule}`));
      if (!this._outputData.has(portName)) this._outputData.set(portName, null);

      let capResult = '';
      try {
        const capGrammar = { ...grammarObj, ParserStart: capRule };
        const capParser  = new nearley.Parser(nearley.Grammar.fromCompiled(capGrammar));
        capParser.feed(inputText);
        if (capParser.results.length > 0) {
          capResult = JSON.stringify(capParser.results[0]);
        }
      } catch { /* no match */ }
      out.set(portName, enc.encode(capResult));
    }

    return out;
  }
}

export const builtinPipes = [NearleyParserPipe];
