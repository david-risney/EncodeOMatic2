/**
 * SHA hash pipe.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';

export class ShaHashPipe extends Pipe {
  static typeName = 'ShaHash';
  static typeDescription = 'SHA Hash';
  static category = 'Encoding';
  static categoryDescription = 'Compute a SHA digest from input bytes.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'algorithm',
        description: 'SHA digest algorithm',
        defaultValue: 'SHA-256',
        type: 'select',
        options: ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
      }),
    ];
  }

  async process(inputs) {
    if (!globalThis.crypto?.subtle) {
      throw new PipeError('Web Crypto is not supported in this environment');
    }

    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const algorithm = this.getConfig('algorithm')?.value ?? 'SHA-256';
    const digest = await crypto.subtle.digest(algorithm, data);
    return new Map([['output', new Uint8Array(digest)]]);
  }
}
