/**
 * Base32 encode/decode pipes (RFC 4648).
 *
 * Supports both the standard Base32 alphabet (A-Z 2-7) and the Base32hex
 * alphabet (0-9 A-V) as defined in RFC 4648 sections 6 and 7.
 *
 * Uses the `rfc4648` library for standards-compliant encoding and decoding.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';
import { base32, base32hex } from '../../../../vendor/rfc4648.js';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

function getCodec(alphabet) {
  return alphabet === 'base32hex' ? base32hex : base32;
}

export class Base32EncodePipe extends Pipe {
  static typeName = 'Base32Encode';
  static typeDescription = 'Base32 Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to a Base32 ASCII string (RFC 4648).';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'alphabet',
        description: 'Base32 alphabet variant',
        defaultValue: 'base32',
        type: 'select',
        options: ['base32', 'base32hex'],
      }),
      new PipeConfig({
        name: 'padding',
        description: 'Include padding characters (=)',
        defaultValue: true,
        type: 'boolean',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const alphabet = this.getConfig('alphabet')?.value ?? 'base32';
    const padding = this.getConfig('padding')?.value ?? true;
    const codec = getCodec(alphabet);
    const encoded = codec.stringify(data, { pad: padding });
    return new Map([['output', TEXT_ENCODER.encode(encoded)]]);
  }
}

export class Base32DecodePipe extends Pipe {
  static typeName = 'Base32Decode';
  static typeDescription = 'Base32 Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode a Base32 ASCII string to bytes (RFC 4648).';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = TEXT_DECODER.decode(input).trim().toUpperCase();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    // Standard Base32: A-Z 2-7 with optional = padding.
    // Require total length >= 8 to avoid false positives on short letter strings.
    if (/^[A-Z2-7]+=*$/.test(text)) return text.length >= 8 ? 8 : 0;
    // Base32hex: 0-9 A-V with optional = padding
    if (/^[0-9A-V]+=*$/.test(text)) return text.length >= 8 ? 7 : 0;
    return -10;
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'alphabet',
        description: 'Base32 alphabet variant',
        defaultValue: 'base32',
        type: 'select',
        options: ['base32', 'base32hex'],
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const alphabet = this.getConfig('alphabet')?.value ?? 'base32';
    const codec = getCodec(alphabet);

    let text;
    try {
      text = TEXT_DECODER.decode(data).trim().toUpperCase();
    } catch {
      throw new PipeError('Invalid Base32 input: not valid UTF-8');
    }

    try {
      const decoded = codec.parse(text, { loose: true });
      return new Map([['output', new Uint8Array(decoded)]]);
    } catch (e) {
      throw new PipeError(`Invalid Base32 input: ${e.message}`);
    }
  }
}

export const builtinPipes = [Base32EncodePipe, Base32DecodePipe];
