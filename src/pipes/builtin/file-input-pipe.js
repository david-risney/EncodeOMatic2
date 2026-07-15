/**
 * File Input Pipe — lets users pick a file from disk as the start of a graph.
 * The file's raw bytes are fed downstream.
 */

import { Pipe, PipeConfig, PortDef } from '../pipe.js';

export class FileInputPipe extends Pipe {
  static typeName = 'FileInputPipe';
  static typeDescription = 'File Input';
  static category = 'Input';
  static categoryDescription = 'Load a file from disk as graph input.';

  defineInputs() {
    return []; // No inputs — this is a source pipe
  }

  defineOutputs() {
    return [new PortDef('output', 'File contents as bytes', true)];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'fileName',
        description: 'Selected file name',
        defaultValue: '',
        type: 'string',
      }),
      new PipeConfig({
        name: 'fileData',
        description: 'File contents (base64-encoded)',
        defaultValue: '',
        type: 'bytes',
      }),
    ];
  }

  async process(_inputs) {
    const fileData = this.getConfig('fileData')?.value ?? '';
    if (!fileData) {
      return new Map([['output', new Uint8Array(0)]]);
    }
    const binary = atob(fileData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Map([['output', bytes]]);
  }
}
