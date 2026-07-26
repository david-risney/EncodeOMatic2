/**
 * CSS escape/unescape pipes.
 *
 * CSS Escape encodes a string so it can be safely used as a CSS identifier or
 * string value. CSS Unescape reverses CSS escape sequences.
 *
 * Encode uses CSS.escape() (browsers) / a compatible implementation (workers).
 * Decode handles \XX hex escapes, \XXXXXX hex escapes, and \<newline> line
 * continuations as defined in the CSS Syntax Level 3 specification.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeError } from '../../pipe.js';

/**
 * CSS.escape() equivalent for environments that may not have it (e.g. workers).
 * Based on the CSS.escape polyfill specification algorithm.
 */
function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  // Polyfill: https://drafts.csswg.org/cssom/#serialize-an-identifier
  let result = '';
  const length = value.length;
  for (let i = 0; i < length; i++) {
    const codePoint = value.codePointAt(i);
    if (codePoint === 0x0000) {
      result += '\uFFFD';
      continue;
    }
    if (
      (codePoint >= 0x0001 && codePoint <= 0x001F) ||
      codePoint === 0x007F ||
      (i === 0 && codePoint >= 0x0030 && codePoint <= 0x0039) ||
      (i === 1 && codePoint >= 0x0030 && codePoint <= 0x0039 &&
        value.codePointAt(0) === 0x002D)
    ) {
      result += `\\${codePoint.toString(16).toUpperCase()} `;
      if (codePoint > 0xFFFF) i++;
      continue;
    }
    if (i === 0 && codePoint === 0x002D && length === 1) {
      result += `\\${value[i]}`;
      continue;
    }
    if (
      codePoint >= 0x0080 ||
      codePoint === 0x002D ||
      codePoint === 0x005F ||
      (codePoint >= 0x0030 && codePoint <= 0x0039) ||
      (codePoint >= 0x0041 && codePoint <= 0x005A) ||
      (codePoint >= 0x0061 && codePoint <= 0x007A)
    ) {
      result += value[i];
      if (codePoint > 0xFFFF) {
        result += value[i + 1];
        i++;
      }
      continue;
    }
    result += `\\${value[i]}`;
  }
  return result;
}

function cssUnescape(value) {
  let result = '';
  let i = 0;
  while (i < value.length) {
    if (value[i] !== '\\') {
      result += value[i++];
      continue;
    }
    // Backslash escape
    i++;
    if (i >= value.length) {
      // Trailing backslash — preserve as-is per lenient parsing
      result += '\\';
      break;
    }
    const next = value[i];
    // Line continuation: \<newline>
    if (next === '\n' || next === '\r' || next === '\f') {
      if (next === '\r' && value[i + 1] === '\n') i++;
      i++;
      continue;
    }
    // Hex escape: \XXXXXX followed by optional whitespace
    if (/[0-9a-fA-F]/u.test(next)) {
      let hex = '';
      for (let j = 0; j < 6 && i < value.length && /[0-9a-fA-F]/u.test(value[i]); j++, i++) {
        hex += value[i];
      }
      // Consume one optional whitespace after hex digits
      if (i < value.length && /[ \t\n\r\f]/u.test(value[i])) i++;
      const codePoint = parseInt(hex, 16);
      if (codePoint === 0 || codePoint > 0x10FFFF) {
        result += '\uFFFD';
      } else {
        result += String.fromCodePoint(codePoint);
      }
      continue;
    }
    // Any other escaped character: just the character itself
    result += next;
    i++;
  }
  return result;
}

export class CssEscapePipe extends StringPipe {
  static typeName = 'CssEscape';
  static typeDescription = 'CSS Escape';
  static category = 'Escaping';
  static categoryDescription = 'Escape a string for safe use as a CSS identifier.';

  async processString(input) {
    try {
      return cssEscape(input);
    } catch (e) {
      throw new PipeError(`CSS escape failed: ${e.message}`);
    }
  }
}

export class CssUnescapePipe extends StringPipe {
  static typeName = 'CssUnescape';
  static typeDescription = 'CSS Unescape';
  static category = 'Escaping';
  static categoryDescription = 'Decode CSS escape sequences in a string.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }
    if (!text.includes('\\')) return 0;
    // Must have at least one valid CSS escape pattern
    if (/\\[0-9a-fA-F]{1,6}|\\[^\n\r\f0-9a-fA-F]/u.test(text)) return 8;
    return 0;
  }

  async processString(input) {
    return cssUnescape(input);
  }
}

export const builtinPipes = [CssEscapePipe, CssUnescapePipe];
