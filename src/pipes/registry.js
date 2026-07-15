/**
 * Pipe Registry — maps type names to pipe classes and provides
 * metadata for the "Add Pipe" UI.
 */

import { InputPipe }         from './builtin/input-pipe.js';
import { FileInputPipe }     from './builtin/file-input-pipe.js';
import { Base64EncodePipe, Base64DecodePipe } from './builtin/encoding/base64.js';
import { PercentEncodePipe, PercentDecodePipe } from './builtin/encoding/percent.js';
import { HexEncodePipe, HexDecodePipe }     from './builtin/encoding/hex.js';
import { HtmlEncodePipe, HtmlDecodePipe }   from './builtin/encoding/html-encode.js';
import { XmlEncodePipe, XmlDecodePipe }     from './builtin/encoding/xml-encode.js';
import { CharsetDecodePipe, CharsetEncodePipe } from './builtin/encoding/charset.js';
import { BinaryEncodePipe, BinaryDecodePipe }   from './builtin/encoding/binary.js';
import { SlashEscapePipe, SlashUnescapePipe }   from './builtin/encoding/slash-escape.js';
import { UrlEncodePipe, UrlDecodePipe }     from './builtin/encoding/url-encode.js';
import { UrlParserPipe }     from './builtin/parsing/url-parser.js';
import { JsonParserPipe }    from './builtin/parsing/json-parser.js';
import { RegexMatchPipe }    from './builtin/parsing/regex-match.js';

/** All built-in pipe classes in the desired display order. */
const ALL_PIPES = [
  InputPipe,
  FileInputPipe,
  // Encoding
  Base64EncodePipe,
  Base64DecodePipe,
  PercentEncodePipe,
  PercentDecodePipe,
  HexEncodePipe,
  HexDecodePipe,
  HtmlEncodePipe,
  HtmlDecodePipe,
  XmlEncodePipe,
  XmlDecodePipe,
  CharsetDecodePipe,
  CharsetEncodePipe,
  BinaryEncodePipe,
  BinaryDecodePipe,
  SlashEscapePipe,
  SlashUnescapePipe,
  UrlEncodePipe,
  UrlDecodePipe,
  // Parsing
  UrlParserPipe,
  JsonParserPipe,
  RegexMatchPipe,
];

/** Map from typeName string → Pipe class */
export const registry = new Map(
  ALL_PIPES.map(cls => [cls.typeName, cls])
);

/**
 * Get pipe entries grouped by category.
 * @returns {Map<string, {typeName, typeDescription, categoryDescription, cls}[]>}
 */
export function getPipesByCategory() {
  const groups = new Map();
  for (const cls of ALL_PIPES) {
    const cat = cls.category ?? 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({
      typeName: cls.typeName,
      typeDescription: cls.typeDescription ?? cls.typeName,
      categoryDescription: cls.categoryDescription ?? '',
      cls,
    });
  }
  return groups;
}

/**
 * Create a new instance of a pipe by type name.
 * @param {string} typeName
 * @returns {import('./pipe.js').Pipe|null}
 */
export function createPipe(typeName) {
  const cls = registry.get(typeName);
  if (!cls) return null;
  return new cls();
}
