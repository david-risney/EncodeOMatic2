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

  async processString(input) {
    return input.replace(/&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z]+));/g,
      (_m, hex, dec, name) => {
        if (hex) return String.fromCodePoint(parseInt(hex, 16));
        if (dec) return String.fromCodePoint(parseInt(dec, 10));
        return XML_DECODE_MAP[name] ?? _m;
      });
  }
}
