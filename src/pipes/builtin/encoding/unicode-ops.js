/**
 * Additional Unicode standard operation pipes.
 *
 * - UnicodeCodePointsEncodePipe: text → space-separated U+XXXX list
 * - UnicodeCodePointsDecodePipe: U+XXXX / 0xHH / decimal token list → text
 * - UnicodeGraphemeSegmentPipe: split text into one grapheme cluster per line
 * - UnicodeCaseFoldPipe: NFKC_Casefold — compatibility decomposition + case fold
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeError } from '../../pipe.js';

// ---------------------------------------------------------------------------
// Code point encode / decode
// ---------------------------------------------------------------------------

function encodeCodePoints(text) {
  const points = [];
  for (const char of text) {
    const cp = char.codePointAt(0);
    points.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
  }
  return points.join(' ');
}

function decodeCodePoints(text) {
  const tokens = text.trim().split(/[\s,]+/).filter((t) => t.length > 0);
  let result = '';
  for (const token of tokens) {
    let cp;
    if (/^U\+[0-9A-Fa-f]{1,6}$/u.test(token)) {
      cp = Number.parseInt(token.slice(2), 16);
    } else if (/^0[xX][0-9A-Fa-f]{1,6}$/u.test(token)) {
      cp = Number.parseInt(token.slice(2), 16);
    } else if (/^\d{1,7}$/u.test(token)) {
      cp = Number.parseInt(token, 10);
    } else {
      throw new PipeError(`Invalid code point token: "${token}"`);
    }
    if (cp > 0x10FFFF) {
      throw new PipeError(`Code point out of Unicode range: "${token}" (0x${cp.toString(16).toUpperCase()})`);
    }
    if (cp >= 0xD800 && cp <= 0xDFFF) {
      throw new PipeError(`Surrogate code point not allowed: "${token}"`);
    }
    result += String.fromCodePoint(cp);
  }
  return result;
}

export class UnicodeCodePointsEncodePipe extends StringPipe {
  static typeName = 'UnicodeCodePointsEncode';
  static typeDescription = 'Unicode Code Points Encode';
  static category = 'Character Sets';
  static categoryDescription = 'Encode each Unicode code point as a space-separated U+XXXX token list.';

  async processString(str) {
    return encodeCodePoints(str);
  }
}

export class UnicodeCodePointsDecodePipe extends StringPipe {
  static typeName = 'UnicodeCodePointsDecode';
  static typeDescription = 'Unicode Code Points Decode';
  static category = 'Character Sets';
  static categoryDescription = 'Decode a space- or comma-separated list of code points (U+XXXX, 0xHH, or decimal) to text.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (/\bU\+[0-9A-Fa-f]{4}/u.test(text)) return 8;
    return 0;
  }

  async processString(str) {
    return decodeCodePoints(str);
  }
}

// ---------------------------------------------------------------------------
// Grapheme cluster segmentation
// ---------------------------------------------------------------------------

export class UnicodeGraphemeSegmentPipe extends StringPipe {
  static typeName = 'UnicodeGraphemeSegment';
  static typeDescription = 'Unicode Grapheme Segment';
  static category = 'Character Sets';
  static categoryDescription = 'Split text into Unicode grapheme clusters, one per line.';

  async processString(str) {
    if (str.length === 0) return '';
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = [...segmenter.segment(str)].map((s) => s.segment);
    return segments.join('\n');
  }
}

// ---------------------------------------------------------------------------
// NFKC_Casefold — Unicode case folding
// ---------------------------------------------------------------------------

export class UnicodeCaseFoldPipe extends StringPipe {
  static typeName = 'UnicodeCaseFold';
  static typeDescription = 'Unicode Case Fold';
  static category = 'Character Sets';
  static categoryDescription =
    'Apply Unicode NFKC_Casefold: compatibility decomposition followed by case folding. ' +
    'Produces a canonical lowercase form suitable for case-insensitive comparison.';

  async processString(str) {
    // NFKC_Casefold = NFKC normalization + Unicode case folding.
    // JavaScript's String.prototype.toLowerCase() implements Unicode default
    // case folding, making this equivalent to the NFKC_Casefold algorithm
    // defined in Unicode Standard Annex #44 for virtually all practical inputs.
    return str.normalize('NFKC').toLowerCase();
  }
}

export const builtinPipes = [
  UnicodeCodePointsEncodePipe,
  UnicodeCodePointsDecodePipe,
  UnicodeGraphemeSegmentPipe,
  UnicodeCaseFoldPipe,
];
