/**
 * Hex encoding/decoding pipes.
 */

import { Pipe, PipeConfig, PipeError, PortDef } from '../../pipe.js';

const UTF8_ENCODER = new TextEncoder();

export class HexEncodePipe extends Pipe {
  static typeName = 'HexEncode';
  static typeDescription = 'Hex Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to a hexadecimal string.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'separator',
        description: 'Separator between hex bytes (empty for none)',
        defaultValue: '',
        type: 'string',
      }),
      new PipeConfig({
        name: 'uppercase',
        description: 'Use uppercase hex digits',
        defaultValue: true,
        type: 'boolean',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const sep = this.getConfig('separator')?.value ?? '';
    const upper = this.getConfig('uppercase')?.value ?? true;
    const hexes = [];
    for (const byte of data) {
      let h = byte.toString(16).padStart(2, '0');
      if (upper) h = h.toUpperCase();
      hexes.push(h);
    }
    const out = hexes.join(sep);
    return new Map([['output', UTF8_ENCODER.encode(out)]]);
  }

  translateSelections(fromPortType, fromPortName, toPortType, toPortName, selections) {
    const separatorLength = UTF8_ENCODER
      .encode(this.getConfig('separator')?.value ?? '').length;
    const stride = 2 + separatorLength;
    if (fromPortType === 'input' && toPortType === 'output') {
      return selections.map(({ index, length }) => ({
        index: index * stride,
        length: Math.max(0, length * stride - separatorLength),
      }));
    }
    if (fromPortType === 'output' && toPortType === 'input') {
      return selections.flatMap(selection => {
        const inputLength = this.getInputData(toPortName)?.length ?? 0;
        const start = Math.max(0, Math.floor(selection.index));
        const end = start + Math.max(0, Math.floor(selection.length));
        const indexes = [];
        const maxIndex = Math.min(Math.ceil(end / stride), inputLength);
        for (let index = 0; index < maxIndex; index++) {
          const tokenStart = index * stride;
          if (tokenStart < end && tokenStart + 2 > start) indexes.push(index);
        }
        return indexes.length === 0 ? [] : [{
          index: indexes[0],
          length: indexes.at(-1) - indexes[0] + 1,
        }];
      });
    }
    return null;
  }
}

export class HexDecodePipe extends Pipe {
  static typeName = 'HexDecode';
  static typeDescription = 'Hex Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode a hexadecimal string to bytes.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    if (/[g-zG-Z]/.test(text)) return -10;
    const hexDigits = text.replace(/[^0-9a-fA-F]/g, '');
    return hexDigits.length > 0 && hexDigits.length % 2 === 0 ? 10 : -10;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data);
    // Strip whitespace and separators, keep only hex digits
    const cleaned = text.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length % 2 !== 0) {
      let charIndex = text.length - 1;
      while (charIndex > 0 && !/[0-9a-fA-F]/.test(text[charIndex])) charIndex--;
      const byteIndex = UTF8_ENCODER.encode(text.slice(0, charIndex)).length;
      throw new PipeError('Hex string has odd number of digits', [
        { index: byteIndex, length: 1 },
      ]);
    }
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      const val = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
      if (isNaN(val)) throw new PipeError(`Invalid hex byte at position ${i * 2}`);
      bytes[i] = val;
    }
    return new Map([['output', bytes]]);
  }

  translateSelections(fromPortType, fromPortName, toPortType, toPortName, selections) {
    const text = new TextDecoder().decode(this.getInputData() ?? new Uint8Array());
    const digitCharacterIndexes = new Set(
      [...text.matchAll(/[0-9a-fA-F]/g)].map(match => match.index)
    );
    const digits = [];
    let byteOffset = 0;
    for (let characterIndex = 0; characterIndex < text.length;) {
      if (digitCharacterIndexes.has(characterIndex)) digits.push(byteOffset);
      const character = String.fromCodePoint(text.codePointAt(characterIndex));
      byteOffset += UTF8_ENCODER.encode(character).length;
      characterIndex += character.length;
    }
    const tokens = [];
    for (let index = 0; index + 1 < digits.length; index += 2) {
      tokens.push({ start: digits[index], end: digits[index + 1] + 1 });
    }
    if (fromPortType === 'input' && toPortType === 'output') {
      return selections.flatMap(selection => {
        const start = selection.index;
        const end = start + selection.length;
        const indexes = tokens
          .map((token, index) => ({ token, index }))
          .filter(({ token }) => token.start < end && token.end > start)
          .map(({ index }) => index);
        return indexes.length === 0 ? [] : [{
          index: indexes[0],
          length: indexes.at(-1) - indexes[0] + 1,
        }];
      });
    }
    if (fromPortType === 'output' && toPortType === 'input') {
      return selections.flatMap(selection => {
        const first = tokens[selection.index];
        const last = tokens[selection.index + selection.length - 1];
        return first && last ? [{ index: first.start, length: last.end - first.start }] : [];
      });
    }
    return null;
  }
}
