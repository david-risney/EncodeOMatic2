/**
 * Punycode (IDN) encode/decode pipes.
 *
 * Converts internationalized domain names (IDN) between their Unicode form
 * and their ASCII-compatible encoding (ACE, "xn--" prefix) using Punycode
 * as defined in RFC 3492.
 *
 * Uses the `punycode` npm library.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeError } from '../../pipe.js';
import { toASCII, toUnicode } from '../../../../vendor/punycode.js';

export class PunycodeEncodePipe extends StringPipe {
  static typeName = 'PunycodeEncode';
  static typeDescription = 'Punycode Encode';
  static category = 'URL Encoding';
  static categoryDescription = 'Encode a Unicode domain name to its ASCII-compatible Punycode form (xn--).';

  async processString(input) {
    try {
      return toASCII(input.trim());
    } catch (e) {
      throw new PipeError(`Cannot Punycode-encode domain: ${e.message}`);
    }
  }
}

export class PunycodeDecodePipe extends StringPipe {
  static typeName = 'PunycodeDecode';
  static typeDescription = 'Punycode Decode';
  static category = 'URL Encoding';
  static categoryDescription = 'Decode a Punycode-encoded domain name (xn--) to its Unicode form.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    // Score positively if any label starts with xn--
    if (/(?:^|\.)xn--/i.test(text)) return 10;
    return 0;
  }

  async processString(input) {
    try {
      return toUnicode(input.trim());
    } catch (e) {
      throw new PipeError(`Cannot Punycode-decode domain: ${e.message}`);
    }
  }
}

export const builtinPipes = [PunycodeEncodePipe, PunycodeDecodePipe];
