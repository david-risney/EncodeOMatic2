/**
 * String reverse pipe.
 *
 * Reverses the input string as Unicode grapheme clusters, preserving multi-
 * codepoint sequences (emoji, combining characters) in the correct order.
 * Falls back to code-point-based reversal in environments without
 * Intl.Segmenter support.
 */

import { StringPipe } from '../../string-pipe.js';

function reverseString(text) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = [...segmenter.segment(text)].map(s => s.segment);
    return segments.reverse().join('');
  }
  // Fallback: reverse by code point (handles most emoji but not ZWJ sequences)
  return [...text].reverse().join('');
}

export class StringReversePipe extends StringPipe {
  static typeName = 'StringReverse';
  static typeDescription = 'String Reverse';
  static category = 'Encoding';
  static categoryDescription = 'Reverse the characters in a string (grapheme-cluster-aware).';

  async processString(input) {
    return reverseString(input);
  }
}
