import test from 'node:test';
import assert from 'node:assert/strict';

import { registry } from '../src/pipes/registry.js';
import { BinaryDecodePipe } from '../src/pipes/builtin/encoding/binary.js';
import { CharsetDecodePipe, CharsetEncodePipe } from '../src/pipes/builtin/encoding/charset.js';
import { HexDecodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { HtmlDecodePipe } from '../src/pipes/builtin/encoding/html-encode.js';
import { PercentDecodePipe } from '../src/pipes/builtin/encoding/percent.js';
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
      assert.equal(Number.isFinite(score), true, PipeClass.typeName);
      assert.ok(score >= -10 && score <= 10, PipeClass.typeName);
    }
  }
});

test('percent and URL decoders distinguish encoded, plain, and malformed input', () => {
  for (const PipeClass of [PercentDecodePipe, UrlDecodePipe]) {
    assert.equal(PipeClass.getInputAppropriateness(encode('hello%20world')), 10);
    assert.equal(PipeClass.getInputAppropriateness(encode('hello world')), 0);
    assert.equal(PipeClass.getInputAppropriateness(encode('hello%2world')), -10);
    assert.equal(PipeClass.getInputAppropriateness(encode('%FF')), -10);
  }
});

test('structured byte decoders score their accepted syntax', () => {
  assert.equal(HexDecodePipe.getInputAppropriateness(encode('de ad be ef')), 10);
  assert.equal(HexDecodePipe.getInputAppropriateness(encode('de.ad.be.ef')), 10);
  assert.equal(HexDecodePipe.getInputAppropriateness(encode('not hex')), -10);
  assert.equal(BinaryDecodePipe.getInputAppropriateness(encode('01000001 01000010')), 10);
  assert.equal(BinaryDecodePipe.getInputAppropriateness(encode('1 10')), 5);
  assert.equal(BinaryDecodePipe.getInputAppropriateness(encode('01000002')), -10);
});

test('entity decoders require recognized, complete entities', () => {
  assert.equal(HtmlDecodePipe.getInputAppropriateness(encode('A &amp; B')), 10);
  assert.equal(HtmlDecodePipe.getInputAppropriateness(encode('A &copy; B')), 10);
  assert.equal(HtmlDecodePipe.getInputAppropriateness(encode('A &unknown; B')), -10);
  assert.equal(XmlDecodePipe.getInputAppropriateness(encode('A &#x26; B')), 10);
  assert.equal(XmlDecodePipe.getInputAppropriateness(encode('A &copy; B')), -10);
  assert.equal(XmlDecodePipe.getInputAppropriateness(encode('A & B')), 0);
});

test('slash unescape scores valid escapes and rejects malformed escapes', () => {
  assert.equal(SlashUnescapePipe.getInputAppropriateness(encode('\\n\\u263A\\x21')), 10);
  assert.equal(SlashUnescapePipe.getInputAppropriateness(encode('plain text')), 0);
  assert.equal(SlashUnescapePipe.getInputAppropriateness(encode('\\u12')), -10);
  assert.equal(SlashUnescapePipe.getInputAppropriateness(encode('\\q')), -10);
});

test('charset pipes score signatures and required UTF-8 input', () => {
  assert.equal(
    CharsetDecodePipe.getInputAppropriateness(new Uint8Array([0xEF, 0xBB, 0xBF, 0x41])),
    10
  );
  assert.equal(CharsetDecodePipe.getInputAppropriateness(encode('plain text')), 0);
  assert.equal(CharsetEncodePipe.getInputAppropriateness(encode('plain text')), 0);
  assert.equal(CharsetEncodePipe.getInputAppropriateness(new Uint8Array([0xFF])), -10);
});

test('parsers score valid input and reject invalid input', () => {
  assert.equal(JsonParserPipe.getInputAppropriateness(encode('{"ok":true}')), 10);
  assert.equal(JsonParserPipe.getInputAppropriateness(encode('not json')), -10);
  assert.equal(UrlParserPipe.getInputAppropriateness(encode('https://example.com/a?b=c')), 10);
  assert.equal(UrlParserPipe.getInputAppropriateness(encode('not a url')), -10);
});
