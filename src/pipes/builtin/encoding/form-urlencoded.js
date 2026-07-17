/**
 * Form URL encode/decode for application/x-www-form-urlencoded values.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeError } from '../../pipe.js';

export class FormUrlencodedEncodePipe extends StringPipe {
  static typeName = 'FormUrlencodedEncode';
  static typeDescription = 'Form URL Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode text as application/x-www-form-urlencoded.';

  async processString(input) {
    return new URLSearchParams([['_', input]]).toString().slice(2);
  }
}

export class FormUrlencodedDecodePipe extends StringPipe {
  static typeName = 'FormUrlencodedDecode';
  static typeDescription = 'Form URL Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode application/x-www-form-urlencoded text.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;

    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }

    if (!text.includes('+') && !text.includes('%')) return 0;
    if (/%(?![0-9a-fA-F]{2})/.test(text)) return -10;

    try {
      decodeURIComponent(text.replace(/\+/g, ' '));
      return 10;
    } catch {
      return -10;
    }
  }

  async processString(input) {
    try {
      return decodeURIComponent(input.replace(/\+/g, ' '));
    } catch {
      throw new PipeError('Invalid form-urlencoded input');
    }
  }
}
