/**
 * XML encoding/decoding pipes.
 * XML has a similar but distinct set of required character escapes from HTML.
 */

import { StringPipe } from '../../string-pipe.js';

const XML_ENCODE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const XML_DECODE_MAP = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

function scoreXmlEntities(input) {
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
    let codePoint = null;
    if (/^#x[0-9a-fA-F]+$/.test(entity)) {
      codePoint = parseInt(entity.slice(2), 16);
    } else if (/^#[0-9]+$/.test(entity)) {
      codePoint = parseInt(entity.slice(1), 10);
    } else if (!Object.hasOwn(XML_DECODE_MAP, entity)) {
      return -10;
    }
    if (codePoint != null && codePoint > 0x10FFFF) return -10;
    found = true;
  }
  if (/&#(?:x)?[^&\s;]*(?:\s|$)/i.test(text)) return -10;
  return found ? 10 : 0;
}

export class XmlEncodePipe extends StringPipe {
  static typeName = 'XmlEncode';
  static typeDescription = 'XML Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode special characters as XML/SGML entities.';

  async processString(input) {
    return input.replace(/[&<>"']/g, ch => XML_ENCODE_MAP[ch]);
  }
}

export class XmlDecodePipe extends StringPipe {
  static typeName = 'XmlDecode';
  static typeDescription = 'XML Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode XML/SGML entities to characters.';

  static getInputAppropriateness(input) {
    return scoreXmlEntities(input);
  }

  async processString(input) {
    return input.replace(/&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z]+));/g,
      (_m, hex, dec, name) => {
        if (hex) return String.fromCodePoint(parseInt(hex, 16));
        if (dec) return String.fromCodePoint(parseInt(dec, 10));
        return XML_DECODE_MAP[name] ?? _m;
      });
  }
}
