/**
 * ZIP archive creation and extraction pipes using fflate.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';
import { zipSync, unzipSync } from '../../../../vendor/fflate.js';

export class ZipPipe extends Pipe {
  static typeName = 'Zip';
  static typeDescription = 'Zip';
  static category = 'Compression';
  static categoryDescription = 'Create a ZIP archive containing the input bytes.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'filename',
        description: 'Entry filename inside the ZIP archive',
        defaultValue: 'data.bin',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const filename = this.getConfig('filename').value || 'data.bin';
    const files = { [filename]: [data, { level: 6 }] };
    const output = zipSync(files);
    return new Map([['output', output]]);
  }
}

export class UnzipPipe extends Pipe {
  static typeName = 'Unzip';
  static typeDescription = 'Unzip';
  static category = 'Compression';
  static categoryDescription = 'Extract a file from a ZIP archive.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'filename',
        description: 'Entry to extract (leave empty to use the first entry)',
        defaultValue: '',
        type: 'string',
      }),
    ];
  }

  static getInputAppropriateness(input) {
    // ZIP magic bytes: PK\x03\x04
    if (input?.length >= 4 && input[0] === 0x50 && input[1] === 0x4b && input[2] === 0x03 && input[3] === 0x04) {
      return 8;
    }
    return 0;
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    let files;
    try {
      files = unzipSync(data);
    } catch {
      throw new PipeError('Unzip failed: corrupt or invalid ZIP data');
    }
    const keys = Object.keys(files);
    if (keys.length === 0) {
      throw new PipeError('ZIP archive contains no files');
    }
    const targetName = this.getConfig('filename').value;
    let fileData;
    if (targetName) {
      fileData = files[targetName];
      if (!fileData) {
        throw new PipeError(`File "${targetName}" not found in ZIP archive`);
      }
    } else {
      fileData = files[keys[0]];
    }
    return new Map([['output', fileData]]);
  }
}

export const builtinPipes = [ZipPipe, UnzipPipe];
