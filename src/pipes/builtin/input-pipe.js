/**
 * Input Pipe — lets users enter text or paste bytes as the start of a graph.
 * The input text is the raw content to feed downstream.
 */

import { Pipe, PipeConfig, PortDef } from '../pipe.js';

export class InputPipe extends Pipe {
  static typeName = 'InputPipe';
  static typeDescription = 'Input Buffer';
  static category = 'Input';
  static categoryDescription = 'Type or paste text to use as graph input.';

  defineInputs() {
    return []; // No inputs — this is a source pipe
  }

  defineOutputs() {
    return [new PortDef('output', 'Text output as UTF-8 bytes', true)];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'text',
        description: 'Input text',
        defaultValue: '',
        type: 'text',
      }),
      new PipeConfig({
        name: 'rawBytes',
        description: 'Raw input bytes',
        defaultValue: null,
        type: 'hidden',
      }),
    ];
  }

  async process(_inputs) {
    const rawBytes = this.getConfig('rawBytes')?.value;
    if (Array.isArray(rawBytes)) {
      return new Map([['output', Uint8Array.from(rawBytes)]]);
    }
    const text = this.getConfig('text')?.value ?? '';
    const encoder = new TextEncoder();
    return new Map([['output', encoder.encode(text)]]);
  }
}
