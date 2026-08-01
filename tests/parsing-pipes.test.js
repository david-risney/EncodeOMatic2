import { describe, expect, it } from 'vitest';
import { UrlParserPipe } from '../src/pipes/builtin/parsing/url-parser.js';
import { JsonParserPipe } from '../src/pipes/builtin/parsing/json-parser.js';
import { XmlParserPipe } from '../src/pipes/builtin/parsing/xml-parser.js';
import { RegexMatchPipe } from '../src/pipes/builtin/parsing/regex-match.js';
import { JwtParserPipe } from '../src/pipes/builtin/parsing/jwt-parser.js';
import { HttpRequestParserPipe } from '../src/pipes/builtin/parsing/http-request-parser.js';
import { CookieParserPipe } from '../src/pipes/builtin/parsing/cookie-parser.js';
import { CsvParserPipe } from '../src/pipes/builtin/parsing/csv-parser.js';
import { HttpResponseParserPipe } from '../src/pipes/builtin/parsing/http-response-parser.js';
import { SearchParamsParserPipe } from '../src/pipes/builtin/parsing/search-params-parser.js';
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

  it('parses IPv6, default ports, and encoded query names', async () => {
    const pipe = new UrlParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('https://[2001:db8::1]:443/path?hello%20world=value')
    ]]));
    expect(decode(result.get('hostname'))).toBe('[2001:db8::1]');
    expect(decode(result.get('port'))).toBe('');
    expect(decode(result.get('origin'))).toBe('https://[2001:db8::1]');
    expect(decode(result.get('query:hello world'))).toBe('value');
  });

  it('rebuilds dynamic query outputs between runs', async () => {
    const pipe = new UrlParserPipe();
    await pipe.process(new Map([['input', encode('https://example.test/?old=1')]]));
    await pipe.process(new Map([['input', encode('https://example.test/?new=2')]]));
    const names = pipe.defineOutputs().map(({ name }) => name);
    expect(names).toContain('query:new');
    expect(names).not.toContain('query:old');
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

  describe('XmlParserPipe', () => {
    it('exposes XML, root text, attributes, and direct child elements', async () => {
      const pipe = new XmlParserPipe();
      const result = await pipe.process(new Map([['input',
        encode('<root id="42"><item>one</item><item>two</item><nested><value>three</value></nested></root>')
      ]]));
      expect(decode(result.get('xml'))).toContain('<root id="42">');
      expect(decode(result.get('text'))).toBe('onetwothree');
      expect(decode(result.get('attribute:id'))).toBe('42');
      expect(decode(result.get('element:item'))).toBe('<item>one</item>\n<item>two</item>');
      expect(decode(result.get('element:nested'))).toBe('<nested><value>three</value></nested>');
    });

    it('exposes configured XPath results instead of default dynamic outputs', async () => {
      const pipe = new XmlParserPipe();
      pipe.setConfig('xpaths', '//item/@id\nstring(//item[2])');
      const result = await pipe.process(new Map([['input',
        encode('<root><item id="one">first</item><item id="two">second</item></root>')
      ]]));
      expect(decode(result.get('xpath://item/@id'))).toBe('one\ntwo');
      expect(decode(result.get('xpath:string(//item[2])'))).toBe('second');
      expect(pipe.defineOutputs().map(({ name }) => name)).toEqual([
        'xml', 'text', 'xpath://item/@id', 'xpath:string(//item[2])',
      ]);
    });

    it('rejects malformed XML and clears dynamic outputs between runs', async () => {
      const pipe = new XmlParserPipe();
      await pipe.process(new Map([['input', encode('<root><old /></root>')]]));
      await pipe.process(new Map([['input', encode('<root><new /></root>')]]));
      expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['xml', 'text', 'element:new']);
      await expect(pipe.process(new Map([['input', encode('<root>')]]))).rejects
        .toMatchObject({ message: expect.stringContaining('Invalid XML:') });
    });
  });

  it('clears dynamic outputs for non-objects and reports invalid JSON', async () => {
    const pipe = new JsonParserPipe();
    await pipe.process(new Map([['input', encode('{"a":1}')]]));
    await pipe.process(new Map([['input', encode('[1,2]')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json']);
    await expect(pipe.process(new Map([['input', encode('{')]]))).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JSON:') });
  });

  it.each([
    ['{}', '{}'],
    ['[]', '[]'],
    ['null', 'null'],
    ['"text"', '"text"'],
    ['0', '0'],
  ])('handles JSON top-level value %s', async (input, expected) => {
    const pipe = new JsonParserPipe();
    const result = await pipe.process(new Map([['input', encode(input)]]));
    expect(decode(result.get('json'))).toBe(expected);
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json']);
  });

  it('exposes keys containing punctuation without changing their names', async () => {
    const pipe = new JsonParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('{"a.b":1,"spaced key":"value","":false}')
    ]]));
    expect(decode(result.get('key:a.b'))).toBe('1');
    expect(decode(result.get('key:spaced key'))).toBe('value');
    expect(decode(result.get('key:'))).toBe('false');
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
    expect(decode(result.get('group:1'))).toBe('A\na');
    expect(decode(result.get('group:2'))).toBe('\nb');
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

  it.each([
    ['^second$', 'm', 'first\nsecond', 'second'],
    ['a.b', 's', 'a\nb', 'a\nb'],
    ['😀', 'u', 'x😀y', '😀'],
    ['word', 'i', 'WORD', 'WORD'],
  ])('honors regex flags for pattern %s', async (pattern, flags, input, expected) => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', pattern);
    pipe.setConfig('flags', flags);
    const result = await pipe.process(new Map([['input', encode(input)]]));
    expect(decode(result.get('match'))).toBe(expected);
  });

  it('handles zero-length matches without hanging', async () => {
    const pipe = new RegexMatchPipe();
    pipe.setConfig('pattern', '^|$');
    const result = await pipe.process(new Map([['input', encode('ab')]]));
    expect(decode(result.get('all-matches'))).toBe('\n');
  });
});

describe('JwtParserPipe', () => {
  it('rejects non-UTF-8 input bytes', async () => {
    const pipe = new JwtParserPipe();
    await expect(pipe.process(new Map([['input', new Uint8Array([0xff])]]))).rejects
      .toMatchObject({ message: 'Invalid JWT: input is not valid UTF-8' });
  });
});

describe('HttpRequestParserPipe', () => {
  it('preserves raw body bytes without UTF-8 round tripping', async () => {
    const pipe = new HttpRequestParserPipe();
    const head = encode('POST /upload HTTP/1.1\r\nHost: example.test\r\n\r\n');
    const body = new Uint8Array([0xff, 0xfe, 0x41]);
    const input = new Uint8Array(head.length + body.length);
    input.set(head, 0);
    input.set(body, head.length);

    const result = await pipe.process(new Map([['input', input]]));
    expect([...result.get('body')]).toEqual([...body]);
  });
});

describe('CookieParserPipe', () => {
  it('exposes expected default configuration (Cookie mode)', () => {
    const pipe = new CookieParserPipe();
    expect(pipe.configs.get('mode').value).toBe('Cookie');
  });

  it('parses a single Cookie name=value pair', async () => {
    const pipe = new CookieParserPipe();
    const result = await pipe.process(new Map([['input', encode('session=abc123')]]));
    expect(decode(result.get('key:session'))).toBe('abc123');
    expect(pipe.defineOutputs().map(o => o.name)).toContain('key:session');
  });

  it('parses multiple Cookie name=value pairs separated by semicolons', async () => {
    const pipe = new CookieParserPipe();
    const result = await pipe.process(new Map([['input', encode('a=1; b=2; c=three')]]));
    expect(decode(result.get('key:a'))).toBe('1');
    expect(decode(result.get('key:b'))).toBe('2');
    expect(decode(result.get('key:c'))).toBe('three');
  });

  it('parses Set-Cookie header: name, value, and attribute fields', async () => {
    const pipe = new CookieParserPipe();
    pipe.setConfig('mode', 'Set-Cookie');
    const result = await pipe.process(new Map([['input',
      encode('session=abc123; Path=/app; Domain=example.com; Max-Age=3600'),
    ]]));
    expect(decode(result.get('key:name'))).toBe('session');
    expect(decode(result.get('key:value'))).toBe('abc123');
    expect(decode(result.get('key:Path'))).toBe('/app');
    expect(decode(result.get('key:Domain'))).toBe('example.com');
    expect(decode(result.get('key:Max-Age'))).toBe('3600');
  });

  it('parses Set-Cookie boolean flags as "true"', async () => {
    const pipe = new CookieParserPipe();
    pipe.setConfig('mode', 'Set-Cookie');
    const result = await pipe.process(new Map([['input',
      encode('id=xyz; Secure; HttpOnly'),
    ]]));
    expect(decode(result.get('key:Secure'))).toBe('true');
    expect(decode(result.get('key:HttpOnly'))).toBe('true');
  });

  it('parses Set-Cookie SameSite and Expires fields', async () => {
    const pipe = new CookieParserPipe();
    pipe.setConfig('mode', 'Set-Cookie');
    const result = await pipe.process(new Map([['input',
      encode('token=xyz; SameSite=Strict; Expires=Wed, 01 Jan 2025 00:00:00 GMT'),
    ]]));
    expect(decode(result.get('key:SameSite'))).toBe('Strict');
    expect(decode(result.get('key:Expires'))).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
  });

  it('handles cookie values with = characters', async () => {
    const pipe = new CookieParserPipe();
    const result = await pipe.process(new Map([['input', encode('token=abc=def=ghi')]]));
    expect(decode(result.get('key:token'))).toBe('abc=def=ghi');
  });

  it('throws PipeError for empty input', async () => {
    await expect(new CookieParserPipe().process(new Map([['input', new Uint8Array(0)]])))
      .rejects.toMatchObject({ message: 'Cookie header value is empty' });
  });

  it('rebuilds dynamic outputs between runs', async () => {
    const pipe = new CookieParserPipe();
    await pipe.process(new Map([['input', encode('old=1')]]));
    await pipe.process(new Map([['input', encode('new=2')]]));
    const names = pipe.defineOutputs().map(o => o.name);
    expect(names).toContain('key:new');
    expect(names).not.toContain('key:old');
  });

  it('scores input appropriateness', () => {
    expect(CookieParserPipe.getInputAppropriateness(null)).toBe(0);
    expect(CookieParserPipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(CookieParserPipe.getInputAppropriateness(encode('session=abc'))).toBe(5);
    expect(CookieParserPipe.getInputAppropriateness(encode('no equals sign'))).toBe(0);
    expect(CookieParserPipe.getInputAppropriateness(encode('host: example.com'))).toBe(0);
  });
});

describe('CsvParserPipe', () => {
  it('exposes expected default configuration', () => {
    const pipe = new CsvParserPipe();
    expect(pipe.configs.get('hasHeader').value).toBe(true);
    expect(pipe.configs.get('delimiter').value).toBe(',');
  });

  it('parses CSV with header row and multiple data rows', async () => {
    const pipe = new CsvParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('name,age\nAlice,30\nBob,25'),
    ]]));
    expect(decode(result.get('col:name'))).toBe('Alice\nBob');
    expect(decode(result.get('col:age'))).toBe('30\n25');
    expect(pipe.defineOutputs().map(o => o.name)).toEqual(['col:name', 'col:age']);
  });

  it('uses column indices when hasHeader is false', async () => {
    const pipe = new CsvParserPipe();
    pipe.setConfig('hasHeader', false);
    const result = await pipe.process(new Map([['input',
      encode('Alice,30\nBob,25'),
    ]]));
    expect(decode(result.get('col:0'))).toBe('Alice\nBob');
    expect(decode(result.get('col:1'))).toBe('30\n25');
  });

  it('handles quoted fields containing commas', async () => {
    const pipe = new CsvParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('a,b\n"hello, world",42'),
    ]]));
    expect(decode(result.get('col:a'))).toBe('hello, world');
    expect(decode(result.get('col:b'))).toBe('42');
  });

  it('handles quoted fields containing double-quote escapes', async () => {
    const pipe = new CsvParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('key,val\n"say ""hi""",ok'),
    ]]));
    expect(decode(result.get('col:key'))).toBe('say "hi"');
  });

  it('supports a custom tab delimiter', async () => {
    const pipe = new CsvParserPipe();
    pipe.setConfig('delimiter', '\t');
    const result = await pipe.process(new Map([['input',
      encode('x\ty\n1\t2'),
    ]]));
    expect(decode(result.get('col:x'))).toBe('1');
    expect(decode(result.get('col:y'))).toBe('2');
  });

  it('returns empty outputs for empty input', async () => {
    const pipe = new CsvParserPipe();
    const result = await pipe.process(new Map([['input', new Uint8Array(0)]]));
    expect(result.size).toBe(0);
    expect(pipe.defineOutputs()).toHaveLength(0);
  });

  it('rebuilds dynamic outputs between runs', async () => {
    const pipe = new CsvParserPipe();
    await pipe.process(new Map([['input', encode('old\n1')]]));
    await pipe.process(new Map([['input', encode('new\n2')]]));
    const names = pipe.defineOutputs().map(o => o.name);
    expect(names).toContain('col:new');
    expect(names).not.toContain('col:old');
  });

  it('scores input appropriateness', () => {
    expect(CsvParserPipe.getInputAppropriateness(null)).toBe(0);
    expect(CsvParserPipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(CsvParserPipe.getInputAppropriateness(encode('name,age\nAlice,30'))).toBe(5);
    expect(CsvParserPipe.getInputAppropriateness(encode('single row only'))).toBe(0);
  });
});

describe('HttpResponseParserPipe', () => {
  it('parses a basic 200 OK response into its components', async () => {
    const pipe = new HttpResponseParserPipe();
    const raw = 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 5\r\n\r\nHello';
    const result = await pipe.process(new Map([['input', encode(raw)]]));
    expect(decode(result.get('version'))).toBe('HTTP/1.1');
    expect(decode(result.get('status'))).toBe('200');
    expect(decode(result.get('reason'))).toBe('OK');
    expect(decode(result.get('body'))).toBe('Hello');
    expect(decode(result.get('header:content-type'))).toBe('text/plain');
    expect(decode(result.get('header:content-length'))).toBe('5');
  });

  it('preserves raw body bytes without UTF-8 re-encoding', async () => {
    const pipe = new HttpResponseParserPipe();
    const head = encode('HTTP/1.1 200 OK\r\n\r\n');
    const body = new Uint8Array([0xff, 0xfe, 0x41]);
    const input = new Uint8Array(head.length + body.length);
    input.set(head, 0);
    input.set(body, head.length);
    const result = await pipe.process(new Map([['input', input]]));
    expect([...result.get('body')]).toEqual([...body]);
  });

  it('parses response with no reason phrase', async () => {
    const pipe = new HttpResponseParserPipe();
    const raw = 'HTTP/1.1 204\r\n\r\n';
    const result = await pipe.process(new Map([['input', encode(raw)]]));
    expect(decode(result.get('status'))).toBe('204');
    expect(decode(result.get('reason'))).toBe('');
  });

  it('handles LF-only line separators', async () => {
    const pipe = new HttpResponseParserPipe();
    const raw = 'HTTP/1.1 200 OK\nX-Header: value\n\nbody';
    const result = await pipe.process(new Map([['input', encode(raw)]]));
    expect(decode(result.get('status'))).toBe('200');
    expect(decode(result.get('header:x-header'))).toBe('value');
    expect(decode(result.get('body'))).toBe('body');
  });

  it('lowercases header names', async () => {
    const pipe = new HttpResponseParserPipe();
    const raw = 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n';
    const result = await pipe.process(new Map([['input', encode(raw)]]));
    expect(result.has('header:content-type')).toBe(true);
    expect(result.has('header:Content-Type')).toBe(false);
  });

  it('aggregates repeated header names into a single port joined with newline', async () => {
    const pipe = new HttpResponseParserPipe();
    const raw = 'HTTP/1.1 200 OK\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2\r\nSet-Cookie: c=3\r\n\r\n';
    const result = await pipe.process(new Map([['input', encode(raw)]]));
    expect(decode(result.get('header:set-cookie'))).toBe('a=1\nb=2\nc=3');
    // Only one port for the repeated header
    const names = pipe.defineOutputs().map(o => o.name);
    expect(names.filter(n => n === 'header:set-cookie')).toHaveLength(1);
  });

  it('rebuilds dynamic header outputs between runs', async () => {
    const pipe = new HttpResponseParserPipe();
    await pipe.process(new Map([['input', encode('HTTP/1.1 200 OK\r\nX-Old: a\r\n\r\n')]]));
    await pipe.process(new Map([['input', encode('HTTP/1.1 200 OK\r\nX-New: b\r\n\r\n')]]));
    const names = pipe.defineOutputs().map(o => o.name);
    expect(names).toContain('header:x-new');
    expect(names).not.toContain('header:x-old');
  });

  it('throws PipeError when no header/body separator is present', async () => {
    await expect(new HttpResponseParserPipe().process(new Map([['input',
      encode('HTTP/1.1 200 OK\r\nNo-Separator: here'),
    ]]))).rejects.toMatchObject({ message: 'Invalid HTTP response: no header/body separator' });
  });

  it('throws PipeError for an invalid status line', async () => {
    await expect(new HttpResponseParserPipe().process(new Map([['input',
      encode('GARBAGE\r\n\r\n'),
    ]]))).rejects.toMatchObject({ message: expect.stringContaining('Invalid HTTP status line') });
  });

  it('scores input appropriateness', () => {
    expect(HttpResponseParserPipe.getInputAppropriateness(null)).toBe(0);
    expect(HttpResponseParserPipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(HttpResponseParserPipe.getInputAppropriateness(encode('HTTP/1.1 200 OK\r\n'))).toBe(10);
    expect(HttpResponseParserPipe.getInputAppropriateness(encode('GET / HTTP/1.1\r\n'))).toBe(0);
  });
});

describe('HttpRequestParserPipe — additional coverage', () => {
  it('parses GET request with multiple headers', async () => {
    const pipe = new HttpRequestParserPipe();
    const raw = 'GET /index.html HTTP/1.1\r\nHost: example.com\r\nAccept: text/html\r\n\r\n';
    const result = await pipe.process(new Map([['input', encode(raw)]]));
    expect(decode(result.get('method'))).toBe('GET');
    expect(decode(result.get('path'))).toBe('/index.html');
    expect(decode(result.get('version'))).toBe('HTTP/1.1');
    expect(decode(result.get('header:host'))).toBe('example.com');
    expect(decode(result.get('header:accept'))).toBe('text/html');
    expect(result.get('body').length).toBe(0);
  });

  it('aggregates repeated header names into a single port joined with newline', async () => {
    const pipe = new HttpRequestParserPipe();
    const raw = 'GET / HTTP/1.1\r\nAccept: text/html\r\nAccept: application/json\r\n\r\n';
    const result = await pipe.process(new Map([['input', encode(raw)]]));
    expect(decode(result.get('header:accept'))).toBe('text/html\napplication/json');
    // Only one port for the repeated header
    const names = pipe.defineOutputs().map(o => o.name);
    expect(names.filter(n => n === 'header:accept')).toHaveLength(1);
  });

  it('throws PipeError for an invalid request line', async () => {
    await expect(new HttpRequestParserPipe().process(new Map([['input',
      encode('GARBAGE\r\n\r\n'),
    ]]))).rejects.toMatchObject({ message: expect.stringContaining('Invalid HTTP request line') });
  });

  it('scores input appropriateness for known HTTP methods', () => {
    expect(HttpRequestParserPipe.getInputAppropriateness(encode('POST / HTTP/1.1\r\n'))).toBe(10);
    expect(HttpRequestParserPipe.getInputAppropriateness(encode('DELETE /x HTTP/1.1\r\n'))).toBe(10);
    expect(HttpRequestParserPipe.getInputAppropriateness(encode('HTTP/1.1 200 OK\r\n'))).toBe(0);
    expect(HttpRequestParserPipe.getInputAppropriateness(null)).toBe(0);
  });
});

describe('JwtParserPipe — additional coverage', () => {
  // Build a synthetic JWT from known parts (no real secret)
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const payload = JSON.stringify({ sub: '1234567890', name: 'Test', iat: 1700000000 });
  const toBase64url = (str) => btoa(str).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const sigBytes = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const validJwt = `${toBase64url(header)}.${toBase64url(payload)}.${sigBytes}`;

  it('decodes header and payload to JSON text', async () => {
    const pipe = new JwtParserPipe();
    const result = await pipe.process(new Map([['input', encode(validJwt)]]));
    expect(JSON.parse(decode(result.get('header')))).toMatchObject({ alg: 'HS256', typ: 'JWT' });
    expect(JSON.parse(decode(result.get('payload')))).toMatchObject({ sub: '1234567890' });
  });

  it('exposes raw signature bytes', async () => {
    const pipe = new JwtParserPipe();
    const result = await pipe.process(new Map([['input', encode(validJwt)]]));
    expect(result.get('signature').length).toBeGreaterThan(0);
  });

  it('accepts trailing whitespace around the token', async () => {
    const pipe = new JwtParserPipe();
    const result = await pipe.process(new Map([['input', encode(`  ${validJwt}  `)]]));
    expect(decode(result.get('header'))).toContain('alg');
  });

  it('throws PipeError for fewer than three dot-separated parts', async () => {
    await expect(new JwtParserPipe().process(new Map([['input', encode('a.b')]]))).rejects
      .toMatchObject({ message: 'Invalid JWT: expected 3 dot-separated parts' });
  });

  it('throws PipeError for more than three dot-separated parts', async () => {
    await expect(new JwtParserPipe().process(new Map([['input', encode('a.b.c.d')]]))).rejects
      .toMatchObject({ message: 'Invalid JWT: expected 3 dot-separated parts' });
  });

  it('throws PipeError for malformed (non-base64url) header', async () => {
    await expect(new JwtParserPipe().process(new Map([['input', encode('!!!.b.c')]]))).rejects
      .toMatchObject({ message: expect.stringContaining('Invalid JWT') });
  });

  it('scores input appropriateness', () => {
    expect(JwtParserPipe.getInputAppropriateness(encode(validJwt))).toBe(10);
    expect(JwtParserPipe.getInputAppropriateness(encode('not.a.jwt with spaces'))).toBe(0);
    expect(JwtParserPipe.getInputAppropriateness(encode('only two parts.here'))).toBe(0);
    expect(JwtParserPipe.getInputAppropriateness(null)).toBe(0);
    expect(JwtParserPipe.getInputAppropriateness(new Uint8Array([0xff]))).toBe(-10);
  });
});

describe('SearchParamsParserPipe', () => {
  it('exposes expected default configuration (multiValue: last)', () => {
    const pipe = new SearchParamsParserPipe();
    expect(pipe.configs.get('multiValue').value).toBe('last');
  });

  it('parses basic key=value pairs', async () => {
    const pipe = new SearchParamsParserPipe();
    const result = await pipe.process(new Map([['input', encode('a=1&b=hello')]]));
    expect(decode(result.get('query:a'))).toBe('1');
    expect(decode(result.get('query:b'))).toBe('hello');
  });

  it('strips a leading ? before parsing', async () => {
    const pipe = new SearchParamsParserPipe();
    const result = await pipe.process(new Map([['input', encode('?x=10&y=20')]]));
    expect(decode(result.get('query:x'))).toBe('10');
    expect(decode(result.get('query:y'))).toBe('20');
  });

  it('keeps only the last value for duplicate keys in "last" mode', async () => {
    const pipe = new SearchParamsParserPipe();
    const result = await pipe.process(new Map([['input', encode('a=1&b=2&a=3')]]));
    expect(decode(result.get('query:a'))).toBe('3');
  });

  it('joins duplicate key values with newline in "join" mode', async () => {
    const pipe = new SearchParamsParserPipe();
    pipe.setConfig('multiValue', 'join');
    const result = await pipe.process(new Map([['input', encode('a=1&a=2&a=3')]]));
    expect(decode(result.get('query:a'))).toBe('1\n2\n3');
  });

  it('percent-decodes keys and values', async () => {
    const pipe = new SearchParamsParserPipe();
    const result = await pipe.process(new Map([['input', encode('hello%20world=caf%C3%A9')]]));
    expect(decode(result.get('query:hello world'))).toBe('café');
  });

  it('returns no outputs for empty input', async () => {
    const pipe = new SearchParamsParserPipe();
    const result = await pipe.process(new Map([['input', new Uint8Array(0)]]));
    expect(result.size).toBe(0);
    expect(pipe.defineOutputs()).toHaveLength(0);
  });

  it('rebuilds dynamic outputs between runs', async () => {
    const pipe = new SearchParamsParserPipe();
    await pipe.process(new Map([['input', encode('old=1')]]));
    await pipe.process(new Map([['input', encode('new=2')]]));
    const names = pipe.defineOutputs().map(o => o.name);
    expect(names).toContain('query:new');
    expect(names).not.toContain('query:old');
  });

  it('scores input appropriateness', () => {
    expect(SearchParamsParserPipe.getInputAppropriateness(null)).toBe(0);
    expect(SearchParamsParserPipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(SearchParamsParserPipe.getInputAppropriateness(encode('?a=1&b=2'))).toBe(8);
    expect(SearchParamsParserPipe.getInputAppropriateness(encode('key=value'))).toBe(8);
    expect(SearchParamsParserPipe.getInputAppropriateness(encode('https://example.com/a'))).toBe(-5);
    expect(SearchParamsParserPipe.getInputAppropriateness(encode('no equals sign'))).toBe(0);
  });
});
