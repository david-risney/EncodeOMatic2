/**
 * Slash escape / unescape pipes (C-style backslash escapes).
 * e.g. newline → \n, tab → \t, null → \0, non-ASCII → \uXXXX
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeConfig, PipeError } from '../../pipe.js';

const ESCAPE_MAP = {
  '\0':  '\\0',
  '\b':  '\\b',
  '\t':  '\\t',
  '\n':  '\\n',
  '\r':  '\\r',
  '\f':  '\\f',
  '\v':  '\\v',
  '\\':  '\\\\',
  '"':   '\\"',
  "'":   "\\'",
};

const UNESCAPE_MAP = {
  '0':  '\0',
  'b':  '\b',
  't':  '\t',
  'n':  '\n',
  'r':  '\r',
  'f':  '\f',
  'v':  '\v',
  '\\': '\\',
  '"':  '"',
  "'":  "'",
};

export class SlashEscapePipe extends StringPipe {
  static typeName = 'SlashEscape';
  static typeDescription = 'Slash Escape';
  static category = 'Encoding';
  static categoryDescription = 'Escape special characters with C-style backslash sequences.';

  defineConfigs() {
    return [
      ...super.defineConfigs(),
      new PipeConfig({
        name: 'escapeNonAscii',
        description: 'Escape non-ASCII characters as \\uXXXX',
        defaultValue: false,
        type: 'boolean',
      }),
    ];
  }

  async processString(input) {
    const escapeNonAscii = this.getConfig('escapeNonAscii')?.value ?? false;
    let out = '';
    for (const ch of input) {
      if (ESCAPE_MAP[ch]) {
        out += ESCAPE_MAP[ch];
      } else if (escapeNonAscii && ch.codePointAt(0) > 127) {
        const cp = ch.codePointAt(0);
        out += cp > 0xFFFF
          ? `\\u{${cp.toString(16).toUpperCase()}}`
          : `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
      } else {
        out += ch;
      }
    }
    return out;
  }
}

export class SlashUnescapePipe extends StringPipe {
  static typeName = 'SlashUnescape';
  static typeDescription = 'Slash Unescape';
  static category = 'Encoding';
  static categoryDescription = 'Unescape C-style backslash sequences.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }
    if (!text.includes('\\')) return 0;

    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '\\') continue;
      const next = text[++i];
      if (next === undefined) return -10;
      if (UNESCAPE_MAP[next] !== undefined) continue;
      if (next === 'x') {
        if (!/^[0-9a-fA-F]{2}$/.test(text.slice(i + 1, i + 3))) return -10;
        i += 2;
        continue;
      }
      if (next !== 'u') return -10;
      if (text[i + 1] === '{') {
        const end = text.indexOf('}', i + 2);
        if (end === -1) return -10;
        const hex = text.slice(i + 2, end);
        if (!/^[0-9a-fA-F]+$/.test(hex) || parseInt(hex, 16) > 0x10FFFF) return -10;
        i = end;
      } else {
        if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) return -10;
        i += 4;
      }
    }
    return 10;
  }

  async processString(input) {
    let out = '';
    let i = 0;
    while (i < input.length) {
      if (input[i] === '\\' && i + 1 < input.length) {
        const next = input[i + 1];
        if (UNESCAPE_MAP[next] !== undefined) {
          out += UNESCAPE_MAP[next];
          i += 2;
        } else if (next === 'x' && i + 3 < input.length) {
          const hex = input.slice(i + 2, i + 4);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 4;
          } else {
            out += '\\';
            i++;
          }
        } else if (next === 'u' && i + 2 < input.length) {
          if (input[i + 2] === '{') {
            const end = input.indexOf('}', i + 3);
            if (end !== -1) {
              const hex = input.slice(i + 3, end);
              if (/^[0-9a-fA-F]+$/.test(hex)) {
                out += String.fromCodePoint(parseInt(hex, 16));
                i = end + 1;
              } else {
                out += '\\'; i++;
              }
            } else {
              out += '\\'; i++;
            }
          } else if (i + 5 < input.length) {
            const hex = input.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              out += String.fromCharCode(parseInt(hex, 16));
              i += 6;
            } else {
              out += '\\'; i++;
            }
          } else {
            out += '\\'; i++;
          }
        } else {
          out += next;
          i += 2;
        }
      } else {
        out += input[i++];
      }
    }
    return out;
  }
}
