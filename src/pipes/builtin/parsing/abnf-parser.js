/**
 * ABNF Parser pipe (RFC 5234).
 *
 * Parses input text against an ABNF grammar provided as a separate input.
 *
 * Inputs:
 *   - input (default)  — text bytes to parse
 *   - grammar          — ABNF grammar text (RFC 5234 format)
 *
 * Configs:
 *   - startRule     — override the auto-detected start rule (first declared rule)
 *   - captureRules  — comma-separated list of rule names to expose as dynamic outputs
 *
 * Outputs:
 *   - valid (default)  — "true" or "false"
 *   - match            — matched text (empty on failure)
 *   - rule:NAME        — one dynamic port per capture rule, first matched text
 */

import { Pipe, PortDef, PipeConfig, PipeError } from '../../pipe.js';
import { apgApi, apgLib } from '../../../../vendor/apg-js.js';

export class AbnfParserPipe extends Pipe {
  static typeName = 'AbnfParser';
  static typeDescription = 'ABNF Parser';
  static category = 'Parsing';
  static categoryDescription = 'Parse text against an ABNF grammar (RFC 5234). Wire a grammar text to the grammar input.';

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineInputs() {
    return [
      new PortDef('input',   'Text to parse',             true),
      new PortDef('grammar', 'ABNF grammar (RFC 5234)'),
    ];
  }

  defineOutputs() {
    return [
      new PortDef('valid', 'Whether input matches the grammar', true),
      new PortDef('match', 'Full matched text (empty if invalid)'),
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
        description: 'Comma-separated rule names to expose as outputs (e.g. "word,number")',
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

    // Compile grammar
    const api = new apgApi(grammarText);
    api.generate();
    if (api.errors.length) {
      throw new PipeError(`ABNF grammar error:\n${api.errorsToAscii()}`);
    }

    const grammarObj = api.toObject();
    const ruleNames  = api.rules.map(r => r.name);

    // Resolve start rule (case-insensitive per RFC 5234)
    const startRuleConfig = (this.getConfig('startRule')?.value ?? '').trim();
    let startRule;
    if (startRuleConfig) {
      startRule = ruleNames.find(n => n.toLowerCase() === startRuleConfig.toLowerCase());
      if (!startRule) throw new PipeError(`Start rule "${startRuleConfig}" not found in grammar`);
    } else {
      startRule = ruleNames[0];
    }

    // Resolve capture rules
    const captureConfig = (this.getConfig('captureRules')?.value ?? '').trim();
    const captureNames  = captureConfig ? captureConfig.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Validate capture rules
    const lcRuleNames = ruleNames.map(n => n.toLowerCase());
    for (const c of captureNames) {
      if (!lcRuleNames.includes(c.toLowerCase())) {
        throw new PipeError(`Capture rule "${c}" not found in grammar`);
      }
    }

    const parser = new apgLib.parser();
    const ast    = new apgLib.ast();
    const ids    = apgLib.ids;

    // Register AST callbacks for each capture rule
    const capturedValues = new Map();
    for (const capture of captureNames) {
      const exactName = ruleNames.find(n => n.toLowerCase() === capture.toLowerCase());
      capturedValues.set(exactName, []);
      ast.callbacks[exactName] = (state, chars, phraseIndex, phraseLength) => {
        if (state === ids.SEM_PRE) {
          const text = String.fromCharCode(...chars.slice(phraseIndex, phraseIndex + phraseLength));
          capturedValues.get(exactName).push(text);
        }
        return ids.SEM_OK;
      };
    }

    if (captureNames.length > 0) {
      parser.ast = ast;
    }

    const result = parser.parse(grammarObj, startRule, inputText);
    const isValid = result.success;

    if (isValid && captureNames.length > 0) {
      ast.translate({});
    }

    const out = new Map();
    out.set('valid', enc.encode(isValid ? 'true' : 'false'));
    out.set('match', enc.encode(isValid ? inputText : ''));

    this._dynamicOutputs = [];
    for (const [exactName, values] of capturedValues) {
      const portName = `rule:${exactName.toLowerCase()}`;
      this._dynamicOutputs.push(new PortDef(portName, `Captured rule: ${exactName}`));
      if (!this._outputData.has(portName)) this._outputData.set(portName, null);
      out.set(portName, enc.encode(values.join('\n')));
    }

    return out;
  }
}
