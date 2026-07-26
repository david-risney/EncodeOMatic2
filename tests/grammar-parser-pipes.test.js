import { describe, expect, it } from 'vitest';
import { AbnfParserPipe }    from '../src/pipes/builtin/parsing/abnf-parser.js';
import { NearleyParserPipe } from '../src/pipes/builtin/parsing/nearley-parser.js';
import { PegParserPipe }     from '../src/pipes/builtin/parsing/peg-parser.js';
import { encode, decode }    from './helpers.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function inputs(inputText, grammarText) {
  return new Map([
    ['input',   encode(inputText)],
    ['grammar', encode(grammarText)],
  ]);
}

// ─── ABNF Parser ────────────────────────────────────────────────────────────

describe('AbnfParserPipe', () => {
  const simpleGrammar = 'start = 1*ALPHA\nALPHA = %x41-5A / %x61-7A\n';

  it('has expected static metadata', () => {
    expect(AbnfParserPipe.typeName).toBe('AbnfParser');
    expect(AbnfParserPipe.category).toBe('Parsing');
  });

  it('has grammar and input ports', () => {
    const pipe = new AbnfParserPipe();
    const names = pipe.defineInputs().map(p => p.name);
    expect(names).toContain('grammar');
    expect(names).toContain('input');
    expect(pipe.defineInputs().find(p => p.isDefault)?.name).toBe('input');
  });

  it('returns valid=true for matching input', async () => {
    const pipe = new AbnfParserPipe();
    const result = await pipe.process(inputs('hello', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('true');
    expect(decode(result.get('match'))).toBe('hello');
  });

  it('returns valid=false for non-matching input', async () => {
    const pipe = new AbnfParserPipe();
    const result = await pipe.process(inputs('hello world', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('false');
    expect(decode(result.get('match'))).toBe('');
  });

  it('throws PipeError for empty grammar', async () => {
    const pipe = new AbnfParserPipe();
    await expect(pipe.process(inputs('hello', ''))).rejects
      .toMatchObject({ message: 'Grammar input is empty' });
  });

  it('throws PipeError for invalid grammar', async () => {
    const pipe = new AbnfParserPipe();
    await expect(pipe.process(inputs('hello', '=== invalid ==='))).rejects
      .toMatchObject({ message: expect.stringContaining('ABNF grammar error') });
  });

  it('throws PipeError for unknown start rule', async () => {
    const pipe = new AbnfParserPipe();
    pipe.setConfig('startRule', 'nonexistent');
    await expect(pipe.process(inputs('hello', simpleGrammar))).rejects
      .toMatchObject({ message: expect.stringContaining('"nonexistent"') });
  });

  it('respects explicit startRule config', async () => {
    const pipe = new AbnfParserPipe();
    pipe.setConfig('startRule', 'ALPHA');
    const result = await pipe.process(inputs('h', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('true');
  });

  it('exposes captureRules as dynamic outputs', async () => {
    const grammar = 'start = word SP word\nword = 1*ALPHA\nSP = 1*\" \"\nALPHA = %x41-5A / %x61-7A\n';
    const pipe = new AbnfParserPipe();
    pipe.setConfig('captureRules', 'word');
    const result = await pipe.process(inputs('hello world', grammar));
    expect(decode(result.get('valid'))).toBe('true');
    expect(decode(result.get('rule:word'))).toBe('hello\nworld');
    expect(pipe.defineOutputs().map(p => p.name)).toContain('rule:word');
  });

  it('throws PipeError for unknown capture rule', async () => {
    const pipe = new AbnfParserPipe();
    pipe.setConfig('captureRules', 'nosuchrule');
    await expect(pipe.process(inputs('hello', simpleGrammar))).rejects
      .toMatchObject({ message: expect.stringContaining('nosuchrule') });
  });

  it('rebuilds dynamic outputs between runs', async () => {
    const grammar = 'start = 1*ALPHA\nALPHA = %x41-5A / %x61-7A\n';
    const pipe = new AbnfParserPipe();
    pipe.setConfig('captureRules', 'ALPHA');
    await pipe.process(inputs('ab', grammar));
    pipe.setConfig('captureRules', '');
    await pipe.process(inputs('cd', grammar));
    const names = pipe.defineOutputs().map(p => p.name);
    expect(names).not.toContain('rule:ALPHA');
    expect(names).not.toContain('rule:alpha');
  });

  it('handles empty input bytes (no data)', async () => {
    const pipe = new AbnfParserPipe();
    const result = await pipe.process(inputs('', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('false');
  });
});

// ─── Nearley Parser ──────────────────────────────────────────────────────────

describe('NearleyParserPipe', () => {
  const simpleGrammar = 'main -> "hello" " " "world"\n';

  it('has expected static metadata', () => {
    expect(NearleyParserPipe.typeName).toBe('NearleyParser');
    expect(NearleyParserPipe.category).toBe('Parsing');
  });

  it('has grammar and input ports', () => {
    const pipe = new NearleyParserPipe();
    const names = pipe.defineInputs().map(p => p.name);
    expect(names).toContain('grammar');
    expect(names).toContain('input');
    expect(pipe.defineInputs().find(p => p.isDefault)?.name).toBe('input');
  });

  it('returns valid=true for matching input', async () => {
    const pipe = new NearleyParserPipe();
    const result = await pipe.process(inputs('hello world', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('true');
    expect(decode(result.get('match'))).toBe('hello world');
  });

  it('returns valid=false for non-matching input', async () => {
    const pipe = new NearleyParserPipe();
    const result = await pipe.process(inputs('goodbye world', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('false');
    expect(decode(result.get('match'))).toBe('');
  });

  it('returns tree output as JSON', async () => {
    const pipe = new NearleyParserPipe();
    const result = await pipe.process(inputs('hello world', simpleGrammar));
    expect(() => JSON.parse(decode(result.get('tree')))).not.toThrow();
  });

  it('throws PipeError for empty grammar', async () => {
    const pipe = new NearleyParserPipe();
    await expect(pipe.process(inputs('hello', ''))).rejects
      .toMatchObject({ message: 'Grammar input is empty' });
  });

  it('throws PipeError for invalid grammar', async () => {
    const pipe = new NearleyParserPipe();
    await expect(pipe.process(inputs('hello', '@@@ bad grammar @@@'))).rejects
      .toMatchObject({ message: expect.stringContaining('Nearley grammar') });
  });

  it('exposes captureRules as dynamic outputs', async () => {
    const grammar = 'main -> word " " word\nword -> [a-z]:+\n';
    const pipe = new NearleyParserPipe();
    pipe.setConfig('captureRules', 'word');
    const result = await pipe.process(inputs('hello world', grammar));
    expect(decode(result.get('valid'))).toBe('true');
    expect(pipe.defineOutputs().map(p => p.name)).toContain('rule:word');
  });

  it('throws PipeError for unknown start rule', async () => {
    const pipe = new NearleyParserPipe();
    pipe.setConfig('startRule', 'nosuchrule');
    await expect(pipe.process(inputs('hello world', simpleGrammar))).rejects
      .toMatchObject({ message: expect.stringContaining('nosuchrule') });
  });

  it('throws PipeError for unknown capture rule', async () => {
    const pipe = new NearleyParserPipe();
    pipe.setConfig('captureRules', 'nosuchrule');
    await expect(pipe.process(inputs('hello world', simpleGrammar))).rejects
      .toMatchObject({ message: expect.stringContaining('nosuchrule') });
  });

  it('handles empty input', async () => {
    const grammar = 'main -> null\n';
    const pipe = new NearleyParserPipe();
    const result = await pipe.process(inputs('', grammar));
    expect(decode(result.get('valid'))).toBe('true');
  });
});

// ─── PEG Parser ──────────────────────────────────────────────────────────────

describe('PegParserPipe', () => {
  const simpleGrammar = 'start = "hello" " " "world" { return text(); }';

  it('has expected static metadata', () => {
    expect(PegParserPipe.typeName).toBe('PegParser');
    expect(PegParserPipe.category).toBe('Parsing');
  });

  it('has grammar and input ports', () => {
    const pipe = new PegParserPipe();
    const names = pipe.defineInputs().map(p => p.name);
    expect(names).toContain('grammar');
    expect(names).toContain('input');
    expect(pipe.defineInputs().find(p => p.isDefault)?.name).toBe('input');
  });

  it('returns valid=true for matching input', async () => {
    const pipe = new PegParserPipe();
    const result = await pipe.process(inputs('hello world', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('true');
    expect(decode(result.get('match'))).toBe('hello world');
  });

  it('returns valid=false for non-matching input', async () => {
    const pipe = new PegParserPipe();
    const result = await pipe.process(inputs('goodbye world', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('false');
    expect(decode(result.get('match'))).toBe('');
  });

  it('returns tree output as JSON', async () => {
    const pipe = new PegParserPipe();
    const grammar = 'start = a:[a-z]+ { return a.join(""); }';
    const result = await pipe.process(inputs('hello', grammar));
    expect(decode(result.get('valid'))).toBe('true');
    expect(() => JSON.parse(decode(result.get('tree')))).not.toThrow();
  });

  it('throws PipeError for empty grammar', async () => {
    const pipe = new PegParserPipe();
    await expect(pipe.process(inputs('hello', ''))).rejects
      .toMatchObject({ message: 'Grammar input is empty' });
  });

  it('throws PipeError for invalid grammar', async () => {
    const pipe = new PegParserPipe();
    await expect(pipe.process(inputs('hello', '=== not a grammar ==='))).rejects
      .toMatchObject({ message: expect.stringContaining('PEG grammar error') });
  });

  it('respects explicit startRule config', async () => {
    const grammar = 'sentence = word " " word\nword = [a-z]+ { return text(); }';
    const pipe = new PegParserPipe();
    pipe.setConfig('startRule', 'word');
    const result = await pipe.process(inputs('hello', grammar));
    expect(decode(result.get('valid'))).toBe('true');
  });

  it('exposes captureRules as dynamic outputs', async () => {
    const grammar = 'sentence = word " " word\nword = [a-z]+ { return text(); }';
    const pipe = new PegParserPipe();
    pipe.setConfig('captureRules', 'word');
    const result = await pipe.process(inputs('hello world', grammar));
    expect(decode(result.get('valid'))).toBe('true');
    expect(pipe.defineOutputs().map(p => p.name)).toContain('rule:word');
  });

  it('handles non-matching input with valid=false and empty tree', async () => {
    const pipe = new PegParserPipe();
    const result = await pipe.process(inputs('nope', simpleGrammar));
    expect(decode(result.get('valid'))).toBe('false');
    expect(decode(result.get('tree'))).toBe('null');
  });

  it('rebuilds dynamic outputs between runs', async () => {
    const grammar = 'start = word\nword = [a-z]+ { return text(); }';
    const pipe = new PegParserPipe();
    pipe.setConfig('captureRules', 'word');
    await pipe.process(inputs('hello', grammar));
    pipe.setConfig('captureRules', '');
    await pipe.process(inputs('hi', grammar));
    const names = pipe.defineOutputs().map(p => p.name);
    expect(names).not.toContain('rule:word');
  });
});
