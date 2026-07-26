/**
 * Base58 encode/decode pipe.
 *
 * Uses the Bitcoin/IPFS Base58 alphabet (1-9 A-H J-N P-Z a-k m-z).
 * This encoding is used in Bitcoin addresses, IPFS content identifiers (CIDs),
 * and other applications where human-readable identifiers are needed and
 * visual ambiguity must be avoided (no 0, O, I, l).
 *
 * Uses the `bs58` library.
 */

import { Pipe, PipeError } from '../../pipe.js';
import bs58 from '../../../../vendor/bs58.js';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

// Base58 alphabet: excludes 0, O, I, l to reduce visual ambiguity
const BASE58_ALPHABET = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

export class Base58EncodePipe extends Pipe {
  static typeName = 'Base58Encode';
  static typeDescription = 'Base58 Encode';
  static category = 'Base Encoding';
  static categoryDescription = 'Encode bytes to a Base58 ASCII string (Bitcoin/IPFS alphabet).';

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const encoded = bs58.encode(data);
    return new Map([['output', TEXT_ENCODER.encode(encoded)]]);
  }
}

export class Base58DecodePipe extends Pipe {
  static typeName = 'Base58Decode';
  static typeDescription = 'Base58 Decode';
  static category = 'Base Encoding';
  static categoryDescription = 'Decode a Base58 ASCII string to bytes (Bitcoin/IPFS alphabet).';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = TEXT_DECODER.decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    return BASE58_ALPHABET.test(text) ? 7 : -10;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);

    let text;
    try {
      text = TEXT_DECODER.decode(data).trim();
    } catch {
      throw new PipeError('Invalid Base58 input: not valid UTF-8');
    }

    const decoded = bs58.decodeUnsafe(text);
    if (decoded == null) {
      throw new PipeError('Invalid Base58 input');
    }
    return new Map([['output', new Uint8Array(decoded)]]);
  }
}
