/**
 * MIME header encoding/decoding pipes (RFC 2047 encoded words).
 *
 * Uses emailjs-mime-codec which handles the full range of charset and
 * encoding variants found in real-world email headers.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeConfig, PipeError } from '../../pipe.js';
import { mimeWordsDecode, mimeWordsEncode } from '../../../../vendor/mime-codec.js';

const MIME_HEADER_INPUT_PATTERN = /=\?[^?]+\?[BbQq]\?[^?]*\?=/;

export class MimeHeaderDecodePipe extends StringPipe {
  static typeName = 'MimeHeaderDecode';
  static typeDescription = 'MIME Header Decode';
  static category = 'String Transform';
  static categoryDescription = 'Decode RFC 2047 encoded words in email headers.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
      return -10;
    }
    return MIME_HEADER_INPUT_PATTERN.test(text) ? 10 : 0;
  }

  async processString(input) {
    try {
      return mimeWordsDecode(input);
    } catch (e) {
      throw new PipeError(`Cannot decode MIME encoded words: ${e.message}`);
    }
  }
}

export class MimeHeaderEncodePipe extends StringPipe {
  static typeName = 'MimeHeaderEncode';
  static typeDescription = 'MIME Header Encode';
  static category = 'String Transform';
  static categoryDescription = 'Encode text as RFC 2047 encoded words for use in email headers.';

  defineConfigs() {
    return [
      ...super.defineConfigs(),
      new PipeConfig({
        name: 'transferEncoding',
        description: 'Transfer encoding: B (Base64) or Q (Quoted-Printable)',
        defaultValue: 'B',
        type: 'select',
        options: ['B', 'Q'],
      }),
      new PipeConfig({
        name: 'charset',
        description: 'Character set to use in the encoded word',
        defaultValue: 'UTF-8',
        type: 'string',
      }),
    ];
  }

  async processString(input) {
    const transferEncoding = this.getConfig('transferEncoding')?.value ?? 'B';
    const charset = this.getConfig('charset')?.value ?? 'UTF-8';
    try {
      return mimeWordsEncode(input, transferEncoding, charset);
    } catch (e) {
      throw new PipeError(`Cannot encode as MIME encoded words: ${e.message}`);
    }
  }
}

export const builtinPipes = [MimeHeaderDecodePipe, MimeHeaderEncodePipe];
