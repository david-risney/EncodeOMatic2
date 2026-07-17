import { describe, expect, it } from 'vitest';
import { RegexMatchPipe } from '../src/pipes/builtin/parsing/regex-match.js';
import { decode, encode } from './helpers.js';

describe('RegexMatchPipe extra coverage', () => {
  it('uses the default pattern and flags when configs are untouched', async () => {
    const pipe = new RegexMatchPipe();
    const result = await pipe.process(new Map([['input', encode('abc')]]));

    expect(pipe.getConfig('pattern').value).toBe('.*');
    expect(pipe.getConfig('flags').value).toBe('g');
    expect(decode(result.get('match'))).toBe('abc');
    expect(decode(result.get('all-matches'))).toBe('abc\n');
  });

  it('adds the global flag when flags are empty and handles an empty pattern', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '');
    pipe.setConfig('flags', '');
    const result = await pipe.process(new Map([['input', encode('ab')]]));

    expect(decode(result.get('match'))).toBe('');
    expect(decode(result.get('all-matches'))).toBe('\n\n');
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['match', 'all-matches']);
  });

  it('treats empty input as a zero-length match for the default pattern', async () => {
    const pipe = new RegexMatchPipe();
    const result = await pipe.process(new Map([['input', encode('')]]));

    expect(result.get('match')).toHaveLength(0);
    expect(result.get('all-matches')).toHaveLength(0);
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['match', 'all-matches']);
  });

  it('exposes every numbered capture group and does not create named-group ports', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '(?<first>a)(b)(c)');
    const result = await pipe.process(new Map([['input', encode('abc')]]));

    expect(decode(result.get('group:1'))).toBe('a');
    expect(decode(result.get('group:2'))).toBe('b');
    expect(decode(result.get('group:3'))).toBe('c');
    expect(pipe.defineOutputs().map(({ name }) => name)).not.toContain('group:first');
  });

  it('joins multiple matches with newline separators even when matches contain newlines', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', 'a.b');
    pipe.setConfig('flags', 's');
    const result = await pipe.process(new Map([['input', encode('a\nba\nb')]]));

    expect(decode(result.get('all-matches'))).toBe('a\nb\na\nb');
  });

  it('decodes non-UTF-8 bytes with replacement characters before matching', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '�a');
    const result = await pipe.process(new Map([['input', Uint8Array.of(0xff, 0x61)]]));

    expect(decode(result.get('match'))).toBe('�a');
  });

  it('supports backreferences', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '(a)\\1');
    const result = await pipe.process(new Map([['input', encode('aa ab')]]));

    expect(decode(result.get('match'))).toBe('aa');
    expect(decode(result.get('group:1'))).toBe('a');
  });

  it('rebuilds dynamic outputs when capture groups shrink or disappear', async () => {
    const pipe = new RegexMatchPipe();

    pipe.setConfig('pattern', '(a)(b)');
    await pipe.process(new Map([['input', encode('ab')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toContain('group:2');

    pipe.setConfig('pattern', '(a)');
    await pipe.process(new Map([['input', encode('a')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['match', 'all-matches', 'group:1']);

    pipe.setConfig('pattern', 'z');
    await pipe.process(new Map([['input', encode('a')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['match', 'all-matches']);
  });

  it('round-trips pattern and flags configs through JSON state', () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '(a+)');
    pipe.setConfig('flags', 'im');

    const restored = new RegexMatchPipe();
    restored.fromJSON(pipe.toJSON());

    expect(restored.getConfig('pattern').value).toBe('(a+)');
    expect(restored.getConfig('flags').value).toBe('im');
  });

  it('inherits the base input appropriateness score', () => {
    expect(RegexMatchPipe.getInputAppropriateness(null)).toBe(0);
    expect(RegexMatchPipe.getInputAppropriateness(Uint8Array.of(0xff, 0x00))).toBe(0);
  });
});
