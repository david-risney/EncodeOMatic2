/**
 * HTML encoding/decoding pipes.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeConfig } from '../../pipe.js';

const HTML_ENCODE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const HTML_ENTITY_PATTERN = /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z]+));/g;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: '\u00A0', copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026',
};

function scoreHtmlEntities(input) {
  if (input == null || input.length === 0) return 0;
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    return -10;
  }

  let found = false;
  const candidates = text.matchAll(/&([^&\s;]*);/g);
  for (const match of candidates) {
    const entity = match[1];
    let codePoint = null;
    if (/^#x[0-9a-fA-F]+$/.test(entity)) {
      codePoint = parseInt(entity.slice(2), 16);
    } else if (/^#[0-9]+$/.test(entity)) {
      codePoint = parseInt(entity.slice(1), 10);
    } else if (!Object.hasOwn(NAMED_ENTITIES, entity)) {
      return -10;
    }
    if (codePoint != null && codePoint > 0x10FFFF) return -10;
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
        description: 'Encoding mode',
        defaultValue: 'minimal',
        type: 'select',
        options: ['minimal', 'all-non-ascii'],
      }),
    ];
  }

  async processString(input) {
    const mode = this.getConfig('mode')?.value ?? 'minimal';
    if (mode === 'all-non-ascii') {
      return [...input].map(ch => {
        if (HTML_ENCODE_MAP[ch]) return HTML_ENCODE_MAP[ch];
        const code = ch.codePointAt(0);
        if (code > 127) return `&#x${code.toString(16).toUpperCase()};`;
        return ch;
      }).join('');
    }
    // minimal: encode only the required HTML characters
    return input.replace(/[&<>"']/g, ch => HTML_ENCODE_MAP[ch]);
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
    return input.replace(HTML_ENTITY_PATTERN, (_match, hex, dec, name) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      if (name) return NAMED_ENTITIES[name] ?? _match;
      return _match;
    });
  }
}
