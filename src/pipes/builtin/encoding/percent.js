/**
 * Percent (URL) encoding pipes.
 * Encodes/decodes using RFC 3986 percent-encoding.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeConfig, PipeError } from '../../pipe.js';

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
      case 'component': return encodeURIComponent(input);
      case 'full':      return encodeURI(input);
      case 'minimal': {
        // Encode only characters that must be percent-encoded per RFC 3986
        return input.replace(/[^A-Za-z0-9\-_.~]/g, ch => {
          const code = ch.charCodeAt(0);
          if (code > 0x7E) {
            // Encode as UTF-8 bytes
            return [...new TextEncoder().encode(ch)]
              .map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
              .join('');
          }
          return '%' + code.toString(16).toUpperCase().padStart(2, '0');
        });
      }
      default: return encodeURIComponent(input);
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
