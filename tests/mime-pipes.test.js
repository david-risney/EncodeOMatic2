import { describe, expect, it } from 'vitest';
import { MimeParserPipe } from '../src/pipes/builtin/parsing/mime-parser.js';
import { MimeMultipartEncodePipe } from '../src/pipes/builtin/encoding/multipart.js';
import { DataUrlDecodePipe, DataUrlEncodePipe } from '../src/pipes/builtin/encoding/data-url.js';
import { decode, encode } from './helpers.js';

const MULTIPART_MESSAGE = [
  'MIME-Version: 1.0',
  'Subject: =?utf-8?B?SGVsbG8=?=',
  'Content-Type: multipart/mixed; boundary="sep"',
  '',
  '--sep',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'plain text',
  '--sep',
  'Content-Type: application/octet-stream',
  'Content-Transfer-Encoding: base64',
  'Content-Disposition: attachment; filename="blob.bin"',
  '',
  'AAECAw==',
  '--sep--',
  '',
].join('\r\n');

describe('MimeParserPipe', () => {
  it('parses multipart messages into headers, parts, and structure', async () => {
    const pipe = new MimeParserPipe();
    const result = await pipe.process(new Map([['input', encode(MULTIPART_MESSAGE)]]));

    expect(decode(result.get('header:subject'))).toBe('Hello');
    expect(decode(result.get('header:content-type'))).toBe('multipart/mixed');
    expect(decode(result.get('part:1'))).toBe('plain text');
    expect([...result.get('part:2')]).toEqual([0, 1, 2, 3]);

    const structure = JSON.parse(decode(result.get('structure')));
    expect(structure.contentType).toBe('multipart/mixed');
    expect(structure.parts).toHaveLength(2);
    expect(structure.parts[0].contentType).toBe('text/plain');
    expect(structure.parts[1].filename).toBe('blob.bin');
    expect(structure.parts[1].size).toBe(4);

    const portNames = pipe.defineOutputs().map(({ name }) => name);
    expect(portNames).toContain('part:1');
    expect(portNames).toContain('header:subject');
  });

  it('parses a single-part message body', async () => {
    const pipe = new MimeParserPipe();
    const result = await pipe.process(new Map([['input', encode(
      'Content-Type: text/plain; charset=utf-8\r\n'
      + 'Content-Transfer-Encoding: quoted-printable\r\n\r\nca=C3=A9'
    )]]));

    expect(decode(result.get('part:1'))).toBe('caé');
    expect(JSON.parse(decode(result.get('structure'))).contentTransferEncoding)
      .toBe('quoted-printable');
  });

  it('uses the contentType config for bodies without headers', async () => {
    const pipe = new MimeParserPipe();
    pipe.setConfig('contentType', 'multipart/form-data; boundary=xyz');
    const body = [
      '--xyz',
      'Content-Disposition: form-data; name="who"',
      '',
      'world',
      '--xyz--',
      '',
    ].join('\r\n');

    const result = await pipe.process(new Map([['input', encode(body)]]));
    expect(decode(result.get('part:1'))).toBe('world');
    expect(JSON.parse(decode(result.get('structure'))).parts[0].name).toBe('who');
  });

  it('rebuilds dynamic outputs between runs and rejects empty input', async () => {
    const pipe = new MimeParserPipe();
    await pipe.process(new Map([['input', encode(MULTIPART_MESSAGE)]]));
    await pipe.process(new Map([['input', encode('Content-Type: text/plain\r\n\r\nsolo')]]));

    const portNames = pipe.defineOutputs().map(({ name }) => name);
    expect(portNames).toContain('part:1');
    expect(portNames).not.toContain('part:2');

    await expect(pipe.process(new Map([['input', new Uint8Array(0)]])))
      .rejects.toMatchObject({ message: 'MIME input is empty' });
  });

  it('scores multipart input as appropriate and HTTP messages as neutral', () => {
    expect(MimeParserPipe.getInputAppropriateness(encode(MULTIPART_MESSAGE))).toBe(10);
    expect(MimeParserPipe.getInputAppropriateness(encode('Content-Type: text/plain\r\n\r\nhi'))).toBe(5);
    expect(MimeParserPipe.getInputAppropriateness(
      encode('POST /x HTTP/1.1\r\nContent-Type: multipart/form-data; boundary=b\r\n\r\n')
    )).toBe(0);
    expect(MimeParserPipe.getInputAppropriateness(encode('hello'))).toBe(0);
    expect(MimeParserPipe.getInputAppropriateness(null)).toBe(0);
  });
});

describe('MimeMultipartEncodePipe', () => {
  it('builds a multipart/mixed body that round trips through the parser', async () => {
    const pipe = new MimeMultipartEncodePipe();
    pipe.setConfig('boundary', 'sep');
    pipe.setConfig('contentTypes', 'text/plain, application/json');
    const result = await pipe.process(new Map([
      ['part1', encode('first')],
      ['part2', encode('{"a":1}')],
    ]));

    const body = decode(result.get('output'));
    expect(body).toContain('--sep\r\nContent-Type: text/plain\r\n\r\nfirst\r\n');
    expect(body.endsWith('--sep--\r\n')).toBe(true);
    expect(decode(result.get('contentType'))).toBe('multipart/mixed; boundary="sep"');

    const parser = new MimeParserPipe();
    parser.setConfig('contentType', 'multipart/mixed; boundary=sep');
    const parsed = await parser.process(new Map([['input', result.get('output')]]));
    expect(decode(parsed.get('part:1'))).toBe('first');
    expect(decode(parsed.get('part:2'))).toBe('{"a":1}');
  });

  it('emits form-data dispositions and honors partCount', async () => {
    const pipe = new MimeMultipartEncodePipe();
    pipe.setConfig('subtype', 'form-data');
    pipe.setConfig('partCount', 3);
    pipe.setConfig('fieldNames', 'alpha, beta');
    pipe.setConfig('boundary', 'b0');

    expect(pipe.defineInputs().map(({ name }) => name)).toEqual(['part1', 'part2', 'part3']);

    const result = await pipe.process(new Map([
      ['part1', encode('a')],
      ['part2', encode('b')],
    ]));
    const body = decode(result.get('output'));
    expect(body).toContain('Content-Disposition: form-data; name="alpha"');
    expect(body).toContain('Content-Disposition: form-data; name="beta"');
    // The last configured name applies to remaining parts.
    expect(body.match(/name="beta"/g)).toHaveLength(2);
    expect(decode(result.get('contentType'))).toBe('multipart/form-data; boundary="b0"');
  });

  it('applies transfer encodings and top-level headers', async () => {
    const pipe = new MimeMultipartEncodePipe();
    pipe.setConfig('partCount', 1);
    pipe.setConfig('boundary', 'b1');
    pipe.setConfig('transferEncoding', 'base64');
    pipe.setConfig('includeHeaders', true);
    pipe.setConfig('contentTypes', 'application/octet-stream');

    const result = await pipe.process(new Map([['part1', Uint8Array.from([0, 1, 2, 3])]]));
    const body = decode(result.get('output'));
    expect(body.startsWith('MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b1"\r\n\r\n')).toBe(true);
    expect(body).toContain('Content-Transfer-Encoding: base64\r\n\r\nAAECAw==');

    const parsed = await new MimeParserPipe().process(new Map([['input', result.get('output')]]));
    expect([...parsed.get('part:1')]).toEqual([0, 1, 2, 3]);
  });

  it('encodes parts as quoted-printable', async () => {
    const pipe = new MimeMultipartEncodePipe();
    pipe.setConfig('partCount', 1);
    pipe.setConfig('boundary', 'b2');
    pipe.setConfig('transferEncoding', 'quoted-printable');

    const result = await pipe.process(new Map([['part1', encode('café')]]));
    expect(decode(result.get('output'))).toContain('Content-Transfer-Encoding: quoted-printable\r\n\r\ncaf=C3=A9');
  });

  it('rejects invalid boundaries and payloads containing the boundary', async () => {
    const invalid = new MimeMultipartEncodePipe();
    invalid.setConfig('boundary', 'bad"boundary');
    await expect(invalid.process(new Map([['part1', encode('x')]])))
      .rejects.toMatchObject({ message: expect.stringContaining('Invalid multipart boundary') });

    const collision = new MimeMultipartEncodePipe();
    collision.setConfig('partCount', 1);
    collision.setConfig('boundary', 'sep');
    await expect(collision.process(new Map([['part1', encode('a\r\n--sep\r\nb')]])))
      .rejects.toMatchObject({ message: expect.stringContaining('contains the boundary delimiter') });

    const leading = new MimeMultipartEncodePipe();
    leading.setConfig('partCount', 1);
    leading.setConfig('boundary', 'sep');
    await expect(leading.process(new Map([['part1', encode('--sep')]])))
      .rejects.toMatchObject({ message: expect.stringContaining('contains the boundary delimiter') });
  });

  it('clamps partCount to the supported range', () => {
    const pipe = new MimeMultipartEncodePipe();
    pipe.setConfig('partCount', 0);
    expect(pipe.defineInputs()).toHaveLength(1);
    pipe.setConfig('partCount', 99);
    expect(pipe.defineInputs()).toHaveLength(16);
    pipe.setConfig('partCount', 'not a number');
    expect(pipe.defineInputs()).toHaveLength(2);
  });
});

describe('Data URL pipes', () => {
  it('encodes bytes as a base64 data URL', async () => {
    const pipe = new DataUrlEncodePipe();
    pipe.setConfig('mediaType', 'application/octet-stream');
    const result = await pipe.process(new Map([['input', Uint8Array.from([0, 1, 2, 3])]]));
    expect(decode(result.get('output'))).toBe('data:application/octet-stream;base64,AAECAw==');
  });

  it('encodes bytes as a percent-encoded data URL', async () => {
    const pipe = new DataUrlEncodePipe();
    pipe.setConfig('encoding', 'percent');
    pipe.setConfig('mediaType', 'text/plain');
    const result = await pipe.process(new Map([['input', encode('a b\né')]]));
    expect(decode(result.get('output'))).toBe('data:text/plain,a%20b%0A%C3%A9');
  });

  it('decodes base64 and percent data URLs', async () => {
    const base64 = await new DataUrlDecodePipe().process(new Map([['input',
      encode('data:image/png;base64,AAECAw==')]]));
    expect([...base64.get('output')]).toEqual([0, 1, 2, 3]);
    expect(decode(base64.get('mediaType'))).toBe('image/png');
    expect(decode(base64.get('encoding'))).toBe('base64');

    const percent = await new DataUrlDecodePipe().process(new Map([['input',
      encode('data:text/plain;charset=utf-8,a%20b%C3%A9')]]));
    expect(decode(percent.get('output'))).toBe('a bé');
    expect(decode(percent.get('mediaType'))).toBe('text/plain;charset=utf-8');
    expect(decode(percent.get('encoding'))).toBe('percent');
  });

  it('defaults the media type when omitted and round trips through encode', async () => {
    const decoded = await new DataUrlDecodePipe().process(new Map([['input', encode('data:,hi')]]));
    expect(decode(decoded.get('output'))).toBe('hi');
    expect(decode(decoded.get('mediaType'))).toBe('text/plain;charset=US-ASCII');

    const encoder = new DataUrlEncodePipe();
    const encoded = await encoder.process(new Map([['input', encode('round trip')]]));
    const roundTripped = await new DataUrlDecodePipe().process(new Map([['input', encoded.get('output')]]));
    expect(decode(roundTripped.get('output'))).toBe('round trip');
  });

  it('reports invalid data URLs', async () => {
    await expect(new DataUrlDecodePipe().process(new Map([['input', encode('https://example.com')]])))
      .rejects.toMatchObject({ message: expect.stringContaining('Invalid data URL') });
    await expect(new DataUrlDecodePipe().process(new Map([['input', encode('data:text/plain;base64,!!!')]])))
      .rejects.toMatchObject({ message: 'Invalid Base64 payload in data URL' });
    await expect(new DataUrlDecodePipe().process(new Map([['input', encode('data:text/plain,%zz')]])))
      .rejects.toMatchObject({ message: expect.stringContaining('Invalid percent escape') });
  });

  it('scores data URL input appropriateness', () => {
    expect(DataUrlDecodePipe.getInputAppropriateness(encode('data:text/plain,hi'))).toBe(10);
    expect(DataUrlDecodePipe.getInputAppropriateness(encode('data:text/plain'))).toBe(-10);
    expect(DataUrlDecodePipe.getInputAppropriateness(encode('hello'))).toBe(0);
    expect(DataUrlDecodePipe.getInputAppropriateness(Uint8Array.from([0xff, 0xfe]))).toBe(-10);
    expect(DataUrlDecodePipe.getInputAppropriateness(null)).toBe(0);
  });
});
