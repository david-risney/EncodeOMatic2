/**
 * HTML encoding/decoding pipes.
 *
 * Uses the `he` library (https://github.com/mathiasbynens/he) which covers all
 * 2099 HTML5 named character references.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeConfig } from '../../pipe.js';
import he from '../../../../vendor/he.js';

function scoreHtmlEntities(input) {
  if (input == null || input.length === 0) return 0;
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    return -10;
  }

  let found = false;
  for (const match of text.matchAll(/&([^&\s;]*);/g)) {
    const entity = match[1];
    if (/^#x[0-9a-fA-F]+$/.test(entity)) {
      const cp = parseInt(entity.slice(2), 16);
      if (cp > 0x10FFFF) return -10;
    } else if (/^#[0-9]+$/.test(entity)) {
      const cp = parseInt(entity.slice(1), 10);
      if (cp > 0x10FFFF) return -10;
    }
    // he.decode will return the entity unchanged if unknown — treat unknown names
    // as valid candidates since they may still decode
    found = true;
  }
  if (/&#(?:x)?[^&\s;]*(?:\s|$)/i.test(text)) return -10;
  return found ? 10 : 0;
}

export class HtmlEncodePipe extends StringPipe {
  static typeName = 'HtmlEncode';
  static typeDescription = 'HTML Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode special characters as HTML entities.';

  defineConfigs() {
    return [
      ...super.defineConfigs(),
      new PipeConfig({
        name: 'mode',
        description: 'Which characters to encode as HTML entities',
        defaultValue: 'minimal',
        type: 'select',
        options: ['minimal', 'all-non-ascii'],
      }),
    ];
  }

  async processString(input) {
    const mode = this.getConfig('mode')?.value ?? 'minimal';
    if (mode === 'all-non-ascii') {
      // Encode unsafe HTML chars and all non-ASCII using named references where available
      return he.encode(input, { useNamedReferences: true });
    }
    // minimal: encode only the required HTML characters (&, <, >, ", ')
    return he.escape(input);
  }
}

export class HtmlDecodePipe extends StringPipe {
  static typeName = 'HtmlDecode';
  static typeDescription = 'HTML Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode HTML entities to characters.';

  static getInputAppropriateness(input) {
    return scoreHtmlEntities(input);
  }

  async processString(input) {
    return he.decode(input);
  }
}
