/**
 * Percent (URL) encoding pipes.
 * Encodes/decodes using RFC 3986 percent-encoding.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeConfig, PipeError } from '../../pipe.js';

const textEncoder = new TextEncoder();
const percentEncodeBytes = bytes => [...bytes]
  .map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
  .join('');
const RFC3986_UNRESERVED = /^[A-Za-z0-9\-_.~]$/;

export class PercentEncodePipe extends StringPipe {
  static typeName = 'PercentEncode';
  static typeDescription = 'Percent Encode';
  static category = 'Encoding';
  static categoryDescription = 'Percent-encode (URL-encode) each character that needs encoding.';

  defineConfigs() {
    return [
      ...super.defineConfigs(),
      new PipeConfig({
        name: 'mode',
        description: 'Which characters to encode',
        defaultValue: 'component',
        type: 'select',
        options: ['component', 'full', 'minimal'],
      }),
    ];
  }

  async processString(input) {
    const mode = this.getConfig('mode')?.value ?? 'component';
    switch (mode) {
      case 'component':
        return encodeURIComponent(input).replace(/[!'()*]/g, ch => percentEncodeBytes(textEncoder.encode(ch)));
      case 'full':      return encodeURI(input);
      case 'minimal': {
        let output = '';
        for (const ch of input) {
          output += RFC3986_UNRESERVED.test(ch) ? ch : percentEncodeBytes(textEncoder.encode(ch));
        }
        return output;
      }
      default:
        return encodeURIComponent(input).replace(/[!'()*]/g, ch => percentEncodeBytes(textEncoder.encode(ch)));
    }
  }
}

export class PercentDecodePipe extends StringPipe {
  static typeName = 'PercentDecode';
  static typeDescription = 'Percent Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode percent-encoded (URL-encoded) text.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }
    if (!text.includes('%')) return 0;
    if (/%(?![0-9a-fA-F]{2})/.test(text)) return -10;
    try {
      decodeURIComponent(text);
      return 10;
    } catch {
      return -10;
    }
  }

  async processString(input) {
    try {
      return decodeURIComponent(input);
    } catch {
      throw new PipeError('Invalid percent-encoding in input');
    }
  }
}
