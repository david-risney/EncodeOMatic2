import { expect, test } from 'vitest';

import { registry } from '../src/pipes/registry.js';
import { BinaryDecodePipe } from '../src/pipes/builtin/encoding/binary.js';
import { CharsetDecodePipe, CharsetEncodePipe } from '../src/pipes/builtin/encoding/charset.js';
import { HexDecodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { HtmlDecodePipe } from '../src/pipes/builtin/encoding/html-encode.js';
import { PercentDecodePipe } from '../src/pipes/builtin/encoding/percent.js';
import { QuotedPrintableDecodePipe } from '../src/pipes/builtin/encoding/quoted-printable.js';
import { SlashUnescapePipe } from '../src/pipes/builtin/encoding/slash-escape.js';
import { UrlDecodePipe } from '../src/pipes/builtin/encoding/url-encode.js';
import { XmlDecodePipe } from '../src/pipes/builtin/encoding/xml-encode.js';
import { JsonParserPipe } from '../src/pipes/builtin/parsing/json-parser.js';
import { UrlParserPipe } from '../src/pipes/builtin/parsing/url-parser.js';

const encode = value => new TextEncoder().encode(value);

test('every registered pipe returns a bounded score', () => {
  for (const PipeClass of registry.values()) {
    for (const input of [null, new Uint8Array(), encode('example')]) {
      const score = PipeClass.getInputAppropriateness(input);
      expect(Number.isFinite(score), PipeClass.typeName).toBe(true);
      expect(score, PipeClass.typeName).toBeGreaterThanOrEqual(-10);
      expect(score, PipeClass.typeName).toBeLessThanOrEqual(10);
    }
  }
});

test('percent and URL decoders distinguish encoded, plain, and malformed input', () => {
  for (const PipeClass of [PercentDecodePipe, UrlDecodePipe]) {
    expect(PipeClass.getInputAppropriateness(encode('hello%20world'))).toBe(10);
    expect(PipeClass.getInputAppropriateness(encode('hello world'))).toBe(0);
    expect(PipeClass.getInputAppropriateness(encode('hello%2world'))).toBe(-10);
    expect(PipeClass.getInputAppropriateness(encode('%FF'))).toBe(-10);
  }
});

test('structured byte decoders score their accepted syntax', () => {
  expect(HexDecodePipe.getInputAppropriateness(encode('de ad be ef'))).toBe(10);
  expect(HexDecodePipe.getInputAppropriateness(encode('de.ad.be.ef'))).toBe(10);
  expect(HexDecodePipe.getInputAppropriateness(encode('not hex'))).toBe(-10);
  expect(BinaryDecodePipe.getInputAppropriateness(encode('01000001 01000010'))).toBe(10);
  expect(BinaryDecodePipe.getInputAppropriateness(encode('1 10'))).toBe(5);
  expect(BinaryDecodePipe.getInputAppropriateness(encode('01000002'))).toBe(-10);
  expect(QuotedPrintableDecodePipe.getInputAppropriateness(encode('caf=C3=A9'))).toBe(8);
  expect(QuotedPrintableDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
});

test('entity decoders require recognized, complete entities', () => {
  expect(HtmlDecodePipe.getInputAppropriateness(encode('A &amp; B'))).toBe(10);
  expect(HtmlDecodePipe.getInputAppropriateness(encode('A &copy; B'))).toBe(10);
  expect(HtmlDecodePipe.getInputAppropriateness(encode('A &unknown; B'))).toBe(-10);
  expect(XmlDecodePipe.getInputAppropriateness(encode('A &#x26; B'))).toBe(10);
  expect(XmlDecodePipe.getInputAppropriateness(encode('A &copy; B'))).toBe(-10);
  expect(XmlDecodePipe.getInputAppropriateness(encode('A & B'))).toBe(0);
});

test('slash unescape scores valid escapes and rejects malformed escapes', () => {
  expect(SlashUnescapePipe.getInputAppropriateness(encode('\\n\\u263A\\x21'))).toBe(10);
  expect(SlashUnescapePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
  expect(SlashUnescapePipe.getInputAppropriateness(encode('\\u12'))).toBe(-10);
  expect(SlashUnescapePipe.getInputAppropriateness(encode('\\q'))).toBe(-10);
});

test('charset pipes score signatures and required UTF-8 input', () => {
  expect(
    CharsetDecodePipe.getInputAppropriateness(new Uint8Array([0xEF, 0xBB, 0xBF, 0x41]))
  ).toBe(10);
  expect(CharsetDecodePipe.getInputAppropriateness(encode('plain text'))).toBe(0);
  expect(CharsetEncodePipe.getInputAppropriateness(encode('plain text'))).toBe(5);
  expect(CharsetEncodePipe.getInputAppropriateness(new Uint8Array([0xFF]))).toBe(-10);
});

test('parsers score valid input and reject invalid input', () => {
  expect(JsonParserPipe.getInputAppropriateness(encode('{"ok":true}'))).toBe(10);
  expect(JsonParserPipe.getInputAppropriateness(encode('not json'))).toBe(-10);
  expect(UrlParserPipe.getInputAppropriateness(encode('https://example.com/a?b=c'))).toBe(10);
  expect(UrlParserPipe.getInputAppropriateness(encode('not a url'))).toBe(-10);
});
