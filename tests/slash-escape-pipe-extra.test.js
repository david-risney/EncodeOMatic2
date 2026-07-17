import { describe, expect, it } from 'vitest';

import { SlashEscapePipe, SlashUnescapePipe } from '../src/pipes/builtin/encoding/slash-escape.js';
import { decode, encode, processBytes, processText } from './helpers.js';

describe('slash escape pipe extra coverage', () => {
  it('round trips escaped content through slash escape and unescape', async () => {
    const escapePipe = new SlashEscapePipe();
    const source = '\0Line\té😀\\\'"';

    escapePipe.setConfig('escapeNonAscii', true);
    const escaped = await processText(escapePipe, source);

    expect(escaped).toBe('\\0Line\\t\\u00E9\\u{1F600}\\\\\\\'\\"');
    expect(await processText(new SlashUnescapePipe(), escaped)).toBe(source);
  });

  it('leaves non-ASCII unchanged when optional escaping is disabled', async () => {
    expect(await processText(new SlashEscapePipe(), 'café😀')).toBe('café😀');
  });

  it('unescapes hex and Unicode edge cases', async () => {
    expect(await processText(new SlashUnescapePipe(), '\\x00\\xFF\\x41')).toBe('\0ÿA');
    expect(await processText(new SlashUnescapePipe(), '\\u0000\\uFFFF')).toBe('\0\uFFFF');
    expect(await processText(new SlashUnescapePipe(), '\\u{0}\\u{10000}')).toBe('\0\u{10000}');
  });

  it('passes through plain text and invalid Unicode escapes unchanged', async () => {
    expect(await processText(new SlashUnescapePipe(), 'plain text')).toBe('plain text');
    expect(await processText(new SlashUnescapePipe(), '\\u{110000}')).toBe('\\u{110000}');
  });

  it('supports slash escaping with alternate text encodings', async () => {
    const escapePipe = new SlashEscapePipe();
    escapePipe.setConfig('encoding', 'windows-1252');
    escapePipe.setConfig('escapeNonAscii', true);

    expect(decode(await processBytes(escapePipe, [0xE9, 0x80]))).toBe('\\u00E9\\u20AC');

    const unescapePipe = new SlashUnescapePipe();
    unescapePipe.setConfig('encoding', 'windows-1252');
    expect(decode(await processBytes(unescapePipe, encode('\\u00E9\\u20AC')))).toBe('é€');
  });

  it('scores slash-unescape input appropriateness across valid and invalid inputs', () => {
    expect(SlashUnescapePipe.getInputAppropriateness(encode('\\0\\x41\\u0042\\u{1F600}'))).toBe(10);
    expect(SlashUnescapePipe.getInputAppropriateness(encode('no escapes here'))).toBe(0);
    expect(SlashUnescapePipe.getInputAppropriateness(encode('\\'))).toBe(-10);
    expect(SlashUnescapePipe.getInputAppropriateness(encode('\\uZZZZ'))).toBe(-10);
    expect(SlashUnescapePipe.getInputAppropriateness(encode('\\u{110000}'))).toBe(-10);
  });
});
