import { describe, expect, it } from 'vitest';
import { UrlParserPipe } from '../src/pipes/builtin/parsing/url-parser.js';
import { JsonParserPipe } from '../src/pipes/builtin/parsing/json-parser.js';
import { RegexMatchPipe } from '../src/pipes/builtin/parsing/regex-match.js';
import { decode, encode } from './helpers.js';

describe('UrlParserPipe', () => {
  it('returns URL components and dynamic query outputs', async () => {
    const pipe = new UrlParserPipe();
    const result = await pipe.process(new Map([['input',
      encode(' https://example.com:8080/a?q=one&q=two#h ')
    ]]));
    expect(decode(result.get('protocol'))).toBe('https:');
    expect(decode(result.get('hostname'))).toBe('example.com');
    expect(decode(result.get('port'))).toBe('8080');
    expect(decode(result.get('pathname'))).toBe('/a');
    expect(decode(result.get('search'))).toBe('?q=one&q=two');
    expect(decode(result.get('hash'))).toBe('#h');
    expect(decode(result.get('origin'))).toBe('https://example.com:8080');
    expect(decode(result.get('query:q'))).toBe('two');
    expect(pipe.defineOutputs().map(({ name }) => name)).toContain('query:q');
  });

  it('reports invalid URLs', async () => {
    await expect(new UrlParserPipe().process(new Map([['input', encode('not a url')]])))
      .rejects.toMatchObject({ message: 'Invalid URL: "not a url"' });
  });
});

describe('JsonParserPipe', () => {
  it('pretty prints JSON and exposes top-level values', async () => {
    const pipe = new JsonParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('{"text":"hello","number":2,"nested":{"ok":true},"empty":null}')
    ]]));
    expect(decode(result.get('json'))).toContain('\n  "text": "hello"');
    expect(decode(result.get('key:text'))).toBe('hello');
    expect(decode(result.get('key:number'))).toBe('2');
    expect(decode(result.get('key:nested'))).toBe('{"ok":true}');
    expect(decode(result.get('key:empty'))).toBe('null');
    expect(pipe.defineOutputs()).toHaveLength(5);
  });

  it('clears dynamic outputs for non-objects and reports invalid JSON', async () => {
    const pipe = new JsonParserPipe();
    await pipe.process(new Map([['input', encode('{"a":1}')]]));
    await pipe.process(new Map([['input', encode('[1,2]')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json']);
    await expect(pipe.process(new Map([['input', encode('{')]]))).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JSON:') });
  });
});

describe('RegexMatchPipe', () => {
  it('returns first match, all matches, and capture groups', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '(a)(b)?');
    pipe.setConfig('flags', 'iiinvalid');
    const result = await pipe.process(new Map([['input', encode('A ab')]]));
    expect(decode(result.get('match'))).toBe('A');
    expect(decode(result.get('all-matches'))).toBe('A\nab');
    expect(decode(result.get('group:1'))).toBe('A');
    expect(decode(result.get('group:2'))).toBe('');
    expect(pipe.defineOutputs().map(({ name }) => name)).toContain('group:2');
  });

  it('returns empty outputs when there is no match', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', 'z');
    const result = await pipe.process(new Map([['input', encode('abc')]]));
    expect(result.get('match')).toHaveLength(0);
    expect(result.get('all-matches')).toHaveLength(0);
    expect(pipe.defineOutputs()).toHaveLength(2);
  });

  it('reports invalid regular expressions', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '[');
    await expect(pipe.process(new Map([['input', encode('x')]]))).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid regex:') });
  });
});
