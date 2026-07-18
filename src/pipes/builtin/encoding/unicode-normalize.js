import { StringPipe } from '../../string-pipe.js';
import { PipeConfig } from '../../pipe.js';

export class UnicodeNormalizePipe extends StringPipe {
  static typeName = 'UnicodeNormalize';
  static typeDescription = 'Unicode Normalize';
  static category = 'Encoding';
  static categoryDescription = 'Apply Unicode normalization (NFC, NFD, NFKC, or NFKD) to the input text.';

  defineConfigs() {
    return [
      ...super.defineConfigs(),
      new PipeConfig({
        name: 'form',
        description: 'Unicode normalization form',
        defaultValue: 'NFC',
        type: 'select',
        options: ['NFC', 'NFD', 'NFKC', 'NFKD'],
      }),
    ];
  }

  async processString(str) {
    const form = this.getConfig('form')?.value ?? 'NFC';
    return str.normalize(form);
  }
}
