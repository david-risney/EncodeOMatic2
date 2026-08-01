import { Pipe, PortDef, PipeError } from '../../pipe.js';
import { asn1js } from '../../../../vendor/asn1js.js';

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export class Asn1ParserPipe extends Pipe {
  static typeName = 'Asn1Parser';
  static typeDescription = 'ASN.1 Parser';
  static category = 'Data Formats';
  static categoryDescription = 'Parse ASN.1 BER/DER bytes into a JSON structure.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    try {
      const { offset } = asn1js.fromBER(toArrayBuffer(input));
      return offset === input.length ? 10 : -10;
    } catch {
      return -10;
    }
  }

  defineOutputs() {
    return [
      new PortDef('json', 'Parsed ASN.1 structure as JSON', true),
    ];
  }

  async process(inputs) {
    const input = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    if (!input.length) {
      throw new PipeError('Input is empty');
    }

    let parsed;
    try {
      parsed = asn1js.fromBER(toArrayBuffer(input));
    } catch (error) {
      throw new PipeError(`ASN.1 parse error: ${error.message}`);
    }

    if (parsed.offset === -1) {
      const message = parsed.result?.error || 'Invalid ASN.1 BER/DER input';
      throw new PipeError(`ASN.1 parse error: ${message}`);
    }

    if (parsed.offset !== input.length) {
      throw new PipeError(`ASN.1 parse error: trailing bytes at offset ${parsed.offset}`);
    }

    return new Map([
      ['json', new TextEncoder().encode(JSON.stringify(parsed.result.toJSON(), null, 2))],
    ]);
  }
}

export const builtinPipes = [Asn1ParserPipe];
