/**
 * Ascii85 (Base85) encode/decode pipes.
 *
 * Encodes binary data as printable ASCII using the Adobe/PostScript Ascii85
 * encoding scheme. Produces ~25% less overhead than Base64.
 *
 * Pure JavaScript implementation — no library dependency.
 */

import { Pipe, PipeError } from '../../pipe.js';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

const OFFSET = 33; // '!' = 33, 'u' = 117 (offset + 84)

/** Encode a Uint8Array to an Ascii85 string (no delimiters). */
function encodeAscii85(data) {
  let out = '';
  for (let i = 0; i < data.length; i += 4) {
    const b0 = data[i];
    const b1 = i + 1 < data.length ? data[i + 1] : 0;
    const b2 = i + 2 < data.length ? data[i + 2] : 0;
    const b3 = i + 3 < data.length ? data[i + 3] : 0;
    const n = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    const isLastGroup = i + 4 > data.length;
    const remainingBytes = isLastGroup ? data.length - i : 4;

    if (n === 0 && !isLastGroup) {
      out += 'z';
      continue;
    }

    const chars = [
      String.fromCharCode(Math.floor(n / 52200625) + OFFSET),      // 85^4
      String.fromCharCode(Math.floor((n / 614125) % 85) + OFFSET), // 85^3
      String.fromCharCode(Math.floor((n / 7225) % 85) + OFFSET),   // 85^2
      String.fromCharCode(Math.floor((n / 85) % 85) + OFFSET),     // 85^1
      String.fromCharCode((n % 85) + OFFSET),                      // 85^0
    ];
    // Incomplete last group: output only (remainingBytes + 1) chars
    out += isLastGroup ? chars.slice(0, remainingBytes + 1).join('') : chars.join('');
  }
  return out;
}

/** Decode an Ascii85 string (with or without <~ ~> delimiters) to Uint8Array. */
function decodeAscii85(text) {
  let s = text.startsWith('<~') && text.endsWith('~>') ? text.slice(2, -2) : text;
  s = s.replace(/\s/g, '');

  const bytes = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === 'z') {
      bytes.push(0, 0, 0, 0);
      i++;
      continue;
    }
    const group = s.slice(i, i + 5);
    const isLast = group.length < 5;
    const padded = group.padEnd(5, 'u'); // 'u' = OFFSET + 84 = max value
    i += group.length;

    let n = 0;
    for (const ch of padded) {
      const d = ch.charCodeAt(0) - OFFSET;
      if (d < 0 || d > 84) throw new PipeError(`Invalid Ascii85 character: ${JSON.stringify(ch)}`);
      n = n * 85 + d;
    }
    n = n >>> 0;

    const count = isLast ? group.length - 1 : 4;
    if (count >= 1) bytes.push((n >>> 24) & 0xFF);
    if (count >= 2) bytes.push((n >>> 16) & 0xFF);
    if (count >= 3) bytes.push((n >>> 8) & 0xFF);
    if (count >= 4) bytes.push(n & 0xFF);
  }
  return new Uint8Array(bytes);
}

export class Ascii85EncodePipe extends Pipe {
  static typeName = 'Ascii85Encode';
  static typeDescription = 'Ascii85 Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to Ascii85 (Base85) printable ASCII.';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    try {
      const result = encodeAscii85(data);
      return new Map([['output', TEXT_ENCODER.encode(result)]]);
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
    // Ascii85 chars are in range 0x21 (!) to 0x75 (u), plus 'z' for zero group.
    // Optional <~ ... ~> delimiters — when present they are a strong signal.
    // Without delimiters, require at least 8 chars to avoid false positives on short printable-ASCII strings.
    const hasDelimiters = text.startsWith('<~') && text.endsWith('~>');
    const stripped = hasDelimiters ? text.slice(2, -2) : text;
    const contentLen = stripped.replace(/\s/g, '').length;
    if (/^[!-uz\s]*$/.test(stripped) && contentLen > 0 && (hasDelimiters || contentLen >= 8)) return 7;
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
      return new Map([['output', decodeAscii85(text)]]);
    } catch (e) {
      throw new PipeError(`Invalid Ascii85 input: ${e.message}`);
    }
  }
}
