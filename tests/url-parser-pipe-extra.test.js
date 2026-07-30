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

  it('scores absolute URL with unknown scheme lower than well-known scheme', () => {
    // Well-known schemes score 10
    for (const scheme of ['http', 'https', 'ftp', 'ws', 'wss', 'mailto', 'file', 'data', 'blob', 'tel', 'urn', 'about']) {
      expect(
        UrlParserPipe.getInputAppropriateness(encode(`${scheme}:example`)),
        `scheme ${scheme}:`
      ).toBe(10);
    }
    // Unknown scheme scores 7
    expect(UrlParserPipe.getInputAppropriateness(encode('myapp://example.com'))).toBe(7);
    expect(UrlParserPipe.getInputAppropriateness(encode('custom:opaque'))).toBe(7);
  });

  it('scores relative URLs with lower confidence', () => {
    expect(UrlParserPipe.getInputAppropriateness(encode('/path/to/resource'))).toBe(3);
    expect(UrlParserPipe.getInputAppropriateness(encode('?key=value'))).toBe(3);
    expect(UrlParserPipe.getInputAppropriateness(encode('#fragment'))).toBe(3);
    expect(UrlParserPipe.getInputAppropriateness(encode('//example.com/path'))).toBe(3);
  });

  it('defaultOutputName before process() is href', () => {
    const pipe = new UrlParserPipe();
    expect(pipe.defaultOutputName).toBe('href');
  });

  it('defaultOutputName picks the longest non-empty query param after process()', async () => {
    const pipe = new UrlParserPipe();
    await pipe.process(new Map([['input', encode('https://example.com/?short=ab&long=averylongvalue&flag')]]));
    expect(pipe.defaultOutputName).toBe('query:long');
  });

  it('defaultOutputName falls back to longest static output when no valued query params', async () => {
    const pipe = new UrlParserPipe();
    // URL with only flag params (empty values); pathname="/", origin and href excluded.
    // Among protocol("https:"), hostname("example.com"), pathname("/"), search("?flag"), hash(""):
    //   search "?flag" (5 chars) < hostname "example.com" (11 chars) → hostname wins.
    await pipe.process(new Map([['input', encode('https://example.com/?flag')]]));
    expect(pipe.defaultOutputName).toBe('hostname');
  });

  it('defaultOutputName falls back to longest static output when no query params', async () => {
    const pipe = new UrlParserPipe();
    // Among protocol("https:"), hostname("example.com"), pathname("/path"), search(""), hash(""):
    //   hostname "example.com" (11) vs pathname "/path" (5) → hostname wins.
    await pipe.process(new Map([['input', encode('https://example.com/path')]]));
    expect(pipe.defaultOutputName).toBe('hostname');
  });

  it('defaultOutputName falls back to pathname when it is longer than hostname', async () => {
    const pipe = new UrlParserPipe();
    // pathname "/a/very/long/path/here" (21) > hostname "x.co" (4)
    await pipe.process(new Map([['input', encode('https://x.co/a/very/long/path/here')]]));
    expect(pipe.defaultOutputName).toBe('pathname');
  });
});
