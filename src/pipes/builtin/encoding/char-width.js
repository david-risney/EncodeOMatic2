/**
 * Character width conversion pipes.
 *
 * Converts between Unicode fullwidth forms (U+FF01–U+FF5E) and their
 * ASCII/halfwidth equivalents (U+0021–U+007E), and between the fullwidth space
 * U+3000 and the ASCII space U+0020.
 *
 * This conversion is commonly needed when processing East Asian text that mixes
 * fullwidth ASCII variants with standard ASCII.
 */

import { StringPipe } from '../../string-pipe.js';

// Fullwidth exclamation mark U+FF01 through fullwidth tilde U+FF5E map
// to U+0021 through U+007E (a contiguous block of 94 characters).
const FULLWIDTH_OFFSET = 0xFF01 - 0x0021;
const FULLWIDTH_SPACE = '\uFF00'; // U+3000 is ideographic space; U+FF00 is unused
const IDEOGRAPHIC_SPACE = '\u3000';
const ASCII_SPACE = ' ';

function toHalfwidth(text) {
  let result = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xFF01 && cp <= 0xFF5E) {
      result += String.fromCodePoint(cp - FULLWIDTH_OFFSET);
    } else if (ch === IDEOGRAPHIC_SPACE) {
      result += ASCII_SPACE;
    } else {
      result += ch;
    }
  }
  return result;
}

function toFullwidth(text) {
  let result = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0021 && cp <= 0x007E) {
      result += String.fromCodePoint(cp + FULLWIDTH_OFFSET);
    } else if (ch === ASCII_SPACE) {
      result += IDEOGRAPHIC_SPACE;
    } else {
      result += ch;
    }
  }
  return result;
}

function hasFullwidth(text) {
  return /[\uFF01-\uFF5E\u3000]/u.test(text);
}

function hasHalfwidthAscii(text) {
  return /[\x21-\x7E \t]/u.test(text);
}

export class CharWidthToHalfwidthPipe extends StringPipe {
  static typeName = 'CharWidthToHalfwidth';
  static typeDescription = 'Fullwidth to Halfwidth';
  static category = 'Character Sets';
  static categoryDescription = 'Convert Unicode fullwidth characters to ASCII halfwidth equivalents.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }
    return hasFullwidth(text) ? 8 : 0;
  }

  async processString(input) {
    return toHalfwidth(input);
  }
}

export class CharWidthToFullwidthPipe extends StringPipe {
  static typeName = 'CharWidthToFullwidth';
  static typeDescription = 'Halfwidth to Fullwidth';
  static category = 'Character Sets';
  static categoryDescription = 'Convert ASCII halfwidth characters to Unicode fullwidth equivalents.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }
    return hasHalfwidthAscii(text) ? 5 : 0;
  }

  async processString(input) {
    return toFullwidth(input);
  }
}
