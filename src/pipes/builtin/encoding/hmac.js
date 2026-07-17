/**
 * HMAC pipe.
 */

import { Pipe, PipeError, PortDef, PipeConfig } from '../../pipe.js';

export class HmacPipe extends Pipe {
  static typeName = 'Hmac';
  static typeDescription = 'HMAC';
  static category = 'Encoding';
  static categoryDescription = 'Compute an HMAC digest using a key.';

  defineInputs() {
    return [
      new PortDef('input', 'Message bytes', true),
      new PortDef('key', 'HMAC key bytes'),
    ];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'algorithm',
        description: 'Digest algorithm',
        defaultValue: 'SHA-256',
        type: 'select',
        options: ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
      }),
    ];
  }

  async process(inputs) {
    const message = inputs.get('input') ?? new Uint8Array(0);
    const keyData = inputs.get('key');
    if (!keyData || keyData.length === 0) {
      throw new PipeError('HMAC key is required');
    }

    const algorithm = this.getConfig('algorithm')?.value ?? 'SHA-256';
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: { name: algorithm } },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
    return new Map([['output', new Uint8Array(signature)]]);
  }
}
