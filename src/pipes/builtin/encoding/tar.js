/**
 * Tar archive create/extract pipes.
 *
 * TarCreatePipe wraps input bytes as a single-file tar archive.
 * TarExtractPipe extracts a file from a tar archive by index or name.
 *
 * Uses the `nanotar` library.
 */

import { Pipe, PipeConfig, PipeError } from '../../pipe.js';
import { parseTar, createTar } from '../../../../vendor/nanotar.js';

// Tar POSIX magic bytes at offset 257: "ustar"
const USTAR_MAGIC = [0x75, 0x73, 0x74, 0x61, 0x72];

export class TarCreatePipe extends Pipe {
  static typeName = 'TarCreate';
  static typeDescription = 'Tar Create';
  static category = 'Archive';
  static categoryDescription = 'Pack input bytes into a single-file tar archive.';

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'filename',
        description: 'File name to use inside the archive',
        defaultValue: 'file',
        type: 'string',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    const filename = this.getConfig('filename').value || 'file';
    const tarBytes = createTar([{ name: filename, data }]);
    return new Map([['output', tarBytes]]);
  }
}

export class TarExtractPipe extends Pipe {
  static typeName = 'TarExtract';
  static typeDescription = 'Tar Extract';
  static category = 'Archive';
  static categoryDescription = 'Extract a file from a tar archive by index.';

  static getInputAppropriateness(input) {
    if (input == null || input.length < 265) return 0;
    // Check for "ustar" magic at offset 257
    for (let i = 0; i < USTAR_MAGIC.length; i++) {
      if (input[257 + i] !== USTAR_MAGIC[i]) return 0;
    }
    return 8;
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'fileIndex',
        description: 'Zero-based index of the file to extract (files only, directories skipped)',
        defaultValue: 0,
        type: 'number',
      }),
    ];
  }

  async process(inputs) {
    const data = inputs.get(this.defaultInputName) ?? new Uint8Array(0);
    if (data.length === 0) {
      return new Map([['output', new Uint8Array(0)]]);
    }

    let entries;
    try {
      entries = parseTar(data);
    } catch {
      throw new PipeError('Invalid tar archive: could not parse');
    }

    const fileEntries = entries.filter(e => e.type === 'file');
    const index = Number(this.getConfig('fileIndex').value) || 0;

    if (fileEntries.length === 0) {
      throw new PipeError('Tar archive contains no files');
    }
    if (index < 0 || index >= fileEntries.length) {
      throw new PipeError(`File index ${index} out of range (archive has ${fileEntries.length} file(s))`);
    }

    const entry = fileEntries[index];
    const fileData = entry.data ? new Uint8Array(entry.data) : new Uint8Array(0);
    return new Map([['output', fileData]]);
  }
}

export const builtinPipes = [TarCreatePipe, TarExtractPipe];
