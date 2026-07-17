import { describe, expect, it } from 'vitest';

import { UrlParserPipe } from '../src/pipes/builtin/parsing/url-parser.js';
import { decode, encode } from './helpers.js';

describe('UrlParserPipe extra coverage', () => {
  it('defines no configs and exposes auth-related static outputs', () => {
    const pipe = new UrlParserPipe();
    expect(pipe.defineConfigs()).toEqual([]);
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual([
      'href',
      'protocol',
      'username',
      'password',
      'hostname',
      'port',
      'pathname',
      'search',
      'hash',
      'origin',
    ]);
  });

  it('rejects empty and whitespace-only input after trimming', async () => {
    const pipe = new UrlParserPipe();
    await expect(pipe.process(new Map([['input', encode('')]]))).rejects
      .toMatchObject({ message: 'Invalid URL: ""' });
    await expect(pipe.process(new Map([['input', encode('   ')]]))).rejects
      .toMatchObject({ message: 'Invalid URL: ""' });
  });

  it('exposes username and password outputs', async () => {
    const pipe = new UrlParserPipe();
    const authUrl = `https://${'user'}:${'pass'}@example.com/path`;
    const result = await pipe.process(new Map([['input', encode(authUrl)]]));
    expect(decode(result.get('username'))).toBe('user');
    expect(decode(result.get('password'))).toBe('pass');
    expect(decode(result.get('hostname'))).toBe('example.com');
  });

  it('returns empty search, hash, and port values with no query string', async () => {
    const pipe = new UrlParserPipe();
    await pipe.process(new Map([['input', encode('https://example.com/path')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual([
      'href',
      'protocol',
      'username',
      'password',
      'hostname',
      'port',
      'pathname',
      'search',
      'hash',
      'origin',
    ]);

    const result = await pipe.process(new Map([['input', encode('https://example.com/path')]]));
    expect(decode(result.get('search'))).toBe('');
    expect(decode(result.get('hash'))).toBe('');
    expect(decode(result.get('port'))).toBe('');
  });

  it('keeps one dynamic output per query key and uses the last value', async () => {
    const pipe = new UrlParserPipe();
    const result = await pipe.process(new Map([[
      'input',
      encode('https://example.com/?key=one&key=two&empty=&flag'),
    ]]));
    expect(decode(result.get('query:key'))).toBe('two');
    expect(decode(result.get('query:empty'))).toBe('');
    expect(decode(result.get('query:flag'))).toBe('');
    expect(pipe.defineOutputs().map(({ name }) => name).filter(name => name === 'query:key'))
      .toHaveLength(1);
  });

  it('parses file and data URLs', async () => {
    const pipe = new UrlParserPipe();

    let result = await pipe.process(new Map([['input', encode('file:///path/to/file')]]));
    expect(decode(result.get('protocol'))).toBe('file:');
    expect(decode(result.get('pathname'))).toBe('/path/to/file');
    expect(decode(result.get('origin'))).toBe('null');

    result = await pipe.process(new Map([['input', encode('data:text/plain;base64,SGVsbG8=')]]));
    expect(decode(result.get('protocol'))).toBe('data:');
    expect(decode(result.get('pathname'))).toBe('text/plain;base64,SGVsbG8=');
    expect(decode(result.get('origin'))).toBe('null');
  });

  it('truncates long invalid URL errors at 80 characters', async () => {
    const input = `not a url ${'x'.repeat(100)}`;
    await expect(new UrlParserPipe().process(new Map([['input', encode(input)]]))).rejects
      .toMatchObject({ message: `Invalid URL: "${input.slice(0, 80)}"` });
  });

  it('normalizes href, preserves encoded paths, and clears dynamic outputs on later runs', async () => {
    const pipe = new UrlParserPipe();
    await pipe.process(new Map([['input', encode('https://example.com/?old=1')]]));

    const result = await pipe.process(new Map([['input', encode('https://example.com/%E2%9C%93')]]));
    expect(decode(result.get('href'))).toBe('https://example.com/%E2%9C%93');
    expect(decode(result.get('pathname'))).toBe('/%E2%9C%93');
    expect(pipe.defineOutputs().map(({ name }) => name)).not.toContain('query:old');

    const normalized = await pipe.process(new Map([['input', encode('https://example.com')]]));
    expect(decode(normalized.get('href'))).toBe('https://example.com/');
  });

  it('scores valid, invalid, empty, whitespace-only, and null input', () => {
    expect(UrlParserPipe.getInputAppropriateness(encode('https://example.com'))).toBe(10);
    expect(UrlParserPipe.getInputAppropriateness(encode('not a url'))).toBe(-10);
    expect(UrlParserPipe.getInputAppropriateness(encode(''))).toBe(0);
    expect(UrlParserPipe.getInputAppropriateness(encode('   '))).toBe(0);
    expect(UrlParserPipe.getInputAppropriateness(null)).toBe(0);
  });
});
