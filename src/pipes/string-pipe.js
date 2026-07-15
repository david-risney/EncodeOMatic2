/**
 * Base class for pipes that process text (string) data.
 *
 * Converts input bytes to a string using the configured text encoding,
 * passes the string to processString(), and encodes the output back to bytes.
 * This allows subclasses to work with strings without dealing with byte encoding.
 */

import { Pipe, PipeConfig, PipeError } from './pipe.js';

const SUPPORTED_ENCODINGS = [
  'utf-8',
  'utf-16be',
  'utf-16le',
  'utf-16',
  'iso-8859-1',
  'windows-1252',
  'ascii',
  'latin1',
];

export class StringPipe extends Pipe {
  defineConfigs() {
    return [
      ...super.defineConfigs(),
      new PipeConfig({
        name: 'encoding',
        description: 'Text encoding for interpreting input/output bytes',
        defaultValue: 'utf-8',
        type: 'select',
        options: SUPPORTED_ENCODINGS,
      }),
    ];
  }

  /**
   * Process string input to string output.
   * Subclasses implement this instead of process().
   * @param {string} input
   * @returns {Promise<string>}
   * @throws {PipeError}
   */
  async processString(input) {
    throw new Error(`${this.constructor.name}.processString() not implemented`);
  }

  async process(inputs) {
    const encoding = this.getConfig('encoding')?.value ?? 'utf-8';
    const inputData = inputs.get(this.defaultInputName) ?? new Uint8Array(0);

    let inputStr;
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      inputStr = decoder.decode(inputData);
    } catch {
      throw new PipeError(`Cannot decode input bytes as ${encoding}`);
    }

    const outputStr = await this.processString(inputStr);

    const encoder = new TextEncoder();
    return new Map([[this.defaultOutputName, encoder.encode(outputStr)]]);
  }
}
