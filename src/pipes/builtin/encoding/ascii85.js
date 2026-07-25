/**
 * Ascii85 (Base85) encode/decode pipes.
 *
 * Encodes binary data as printable ASCII using the Adobe/PostScript Ascii85
 * encoding scheme. Produces ~25% less overhead than Base64.
 *
 * Uses the `ascii85` library.
 */

import { Pipe, PipeError } from '../../pipe.js';
import { ascii85Encode, ascii85Decode } from '../../../../vendor/ascii85.js';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

export class Ascii85EncodePipe extends Pipe {
  static typeName = 'Ascii85Encode';
  static typeDescription = 'Ascii85 Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to Ascii85 (Base85) printable ASCII.';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    try {
      const result = ascii85Encode(data, { delimiter: false });
      return new Map([['output', TEXT_ENCODER.encode(result.toString())]]);
    } catch (e) {
      throw new PipeError(`Ascii85 encode failed: ${e.message}`);
    }
  }
}

export class Ascii85DecodePipe extends Pipe {
  static typeName = 'Ascii85Decode';
  static typeDescription = 'Ascii85 Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode Ascii85 (Base85) encoded text to bytes.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = TEXT_DECODER.decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    // Ascii85 chars are in range 0x21 (!) to 0x75 (u), plus 'z' for zero group
    // Optional <~ ... ~> delimiters
    const stripped = text.startsWith('<~') && text.endsWith('~>')
      ? text.slice(2, -2)
      : text;
    if (/^[!-uz\s]*$/.test(stripped) && stripped.replace(/\s/g, '').length > 0) return 7;
    return 0;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);

    let text;
    try {
      text = TEXT_DECODER.decode(data).trim();
    } catch {
      throw new PipeError('Invalid Ascii85 input: not valid UTF-8');
    }

    try {
      const decoded = ascii85Decode(Buffer.from(text));
      return new Map([['output', new Uint8Array(decoded)]]);
    } catch (e) {
      throw new PipeError(`Invalid Ascii85 input: ${e.message}`);
    }
  }
}
