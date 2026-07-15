/**
 * URL encode/decode — encodes a full URL or individual URI components.
 * Different from percent-encode: targets the whole URL string.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeError } from '../../pipe.js';

export class UrlEncodePipe extends StringPipe {
  static typeName = 'UrlEncode';
  static typeDescription = 'URL Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode a URI using encodeURI (preserves URI structure characters).';

  async processString(input) {
    try {
      return encodeURI(input);
    } catch {
      throw new PipeError('Cannot encode input as URI');
    }
  }
}

export class UrlDecodePipe extends StringPipe {
  static typeName = 'UrlDecode';
  static typeDescription = 'URL Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode a URI using decodeURI.';

  async processString(input) {
    try {
      return decodeURI(input);
    } catch {
      throw new PipeError('Invalid URI encoding in input');
    }
  }
}
