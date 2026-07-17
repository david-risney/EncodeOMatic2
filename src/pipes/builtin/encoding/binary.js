/**
 * Binary (base-2) encoding/decoding pipes.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';

const UTF8_ENCODER = new TextEncoder();

function getTokenByteIndex(text, charIndex) {
  return UTF8_ENCODER.encode(text.slice(0, charIndex)).length;
}

function getBinaryByteRanges(text) {
  const byteRanges = [];
  for (const match of text.matchAll(/[^\s,]+/g)) {
    const token = match[0];
    const start = getTokenByteIndex(text, match.index);
    if (!/^[01]+$/.test(token)) return null;
    if (token.length > 8 && token.length % 8 !== 0) return null;
    if (token.length <= 8) {
      byteRanges.push({ start, end: start + token.length });
      continue;
    }
    for (let index = 0; index < token.length; index += 8) {
      byteRanges.push({ start: start + index, end: start + index + 8 });
    }
  }
  return byteRanges;
}

export class BinaryEncodePipe extends Pipe {
  static typeName = 'BinaryEncode';
  static typeDescription = 'Binary Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode bytes to a binary (base-2) bit string.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'separator',
        description: 'Separator between bytes (space, comma, none, etc.)',
        defaultValue: ' ',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const sep = this.getConfig('separator')?.value ?? ' ';
    const bits = [...data].map(b => b.toString(2).padStart(8, '0'));
    return new Map([['output', new TextEncoder().encode(bits.join(sep))]]);
  }

  translateSelections(fromPortType, fromPortName, toPortType, toPortName, selections) {
    const separatorLength = UTF8_ENCODER
      .encode(this.getConfig('separator')?.value ?? ' ').length;
    const stride = 8 + separatorLength;
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
          if (tokenStart < end && tokenStart + 8 > start) indexes.push(index);
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

export class BinaryDecodePipe extends Pipe {
  static typeName = 'BinaryDecode';
  static typeDescription = 'Binary Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode a binary (base-2) bit string to bytes.';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    const tokens = text.split(/[\s,]+/).filter(Boolean);
    if (!tokens.every(token => /^[01]+$/.test(token))) return -10;
    if (tokens.every(token => token.length > 0 && token.length % 8 === 0)) return 10;
    if (tokens.every(token => token.length <= 8)) return 5;
    return -10;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(data);
    const bytes = [];
    const tokens = [...text.matchAll(/[^\s,]+/g)];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i][0];
      if (!/^[01]+$/.test(token) || (token.length > 8 && token.length % 8 !== 0)) {
        const byteIndex = getTokenByteIndex(text, tokens[i].index);
        const byteLength = UTF8_ENCODER.encode(token).length;
        throw new PipeError(`Invalid binary byte at position ${i}: "${token}"`, [
          { index: byteIndex, length: byteLength },
        ]);
      }
      if (token.length <= 8) {
        bytes.push(parseInt(token, 2));
        continue;
      }
      for (let index = 0; index < token.length; index += 8) {
        bytes.push(parseInt(token.slice(index, index + 8), 2));
      }
    }
    return new Map([['output', Uint8Array.from(bytes)]]);
  }

  translateSelections(fromPortType, fromPortName, toPortType, toPortName, selections) {
    const text = new TextDecoder().decode(this.getInputData() ?? new Uint8Array());
    const byteRanges = getBinaryByteRanges(text);
    if (byteRanges == null) return null;
    if (fromPortType === 'input' && toPortType === 'output') {
      return selections.flatMap(selection => {
        const start = selection.index;
        const end = start + selection.length;
        const indexes = byteRanges
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
        const first = byteRanges[selection.index];
        const last = byteRanges[selection.index + selection.length - 1];
        return first && last ? [{ index: first.start, length: last.end - first.start }] : [];
      });
    }
    return null;
  }
}
