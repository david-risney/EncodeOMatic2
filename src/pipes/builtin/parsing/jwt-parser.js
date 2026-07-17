/**
 * JWT Parser pipe.
 *
 * Splits a JSON Web Token into decoded header, payload, and raw signature bytes.
 */

import { Pipe, PipeError, PortDef } from '../../pipe.js';

const OUTPUTS = [
  new PortDef('header', 'Decoded JWT header JSON', true),
  new PortDef('payload', 'Decoded JWT payload JSON'),
  new PortDef('signature', 'Raw JWT signature bytes'),
];

function decodeBase64urlPart(part, label) {
  const normalized = part.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');

  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(padded)) {
    throw new PipeError(`Invalid JWT: malformed ${label}`);
  }

  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    throw new PipeError(`Invalid JWT: malformed ${label}`);
  }
}

export class JwtParserPipe extends Pipe {
  static typeName = 'JwtParser';
  static typeDescription = 'JWT Parse';
  static category = 'Parsing';
  static categoryDescription = 'Split a JWT into header, payload, and signature.';

  static getInputAppropriateness(input) {
    if (!input || input.length === 0) return 0;
    try {
      const str = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
      if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(str)) return 10;
    } catch {
      return -10;
    }
    return 0;
  }

  defineOutputs() {
    return OUTPUTS;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data).trim();
    const parts = text.split('.');

    if (parts.length !== 3) {
      throw new PipeError('Invalid JWT: expected 3 dot-separated parts');
    }

    return new Map([
      ['header', decodeBase64urlPart(parts[0], 'header')],
      ['payload', decodeBase64urlPart(parts[1], 'payload')],
      ['signature', decodeBase64urlPart(parts[2], 'signature')],
    ]);
  }
}
