/**
 * ROT cipher pipe — rotates ASCII letters by a configurable amount (default 13).
 * Non-letter characters are passed through unchanged.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeConfig, PipeError } from '../../pipe.js';

/**
 * Rotate a single letter by `rotation` positions within its case range.
 * @param {string} ch
 * @param {number} rotation
 * @returns {string}
 */
function rotateLetter(ch, rotation) {
  const base = ch >= 'a' ? 97 : 65;
  return String.fromCharCode(((ch.charCodeAt(0) - base + rotation) % 26 + 26) % 26 + base);
}

export class RotPipe extends StringPipe {
  static typeName = 'Rot';
  static typeDescription = 'ROT Cipher';
  static category = 'Encoding';
  static categoryDescription = 'Apply a ROT (rotation) cipher to ASCII letters. Default is ROT13.';

  defineConfigs() {
    return [
      ...super.defineConfigs(),
      new PipeConfig({
        name: 'rotation',
        description: 'Number of positions to rotate letters (0–25)',
        defaultValue: 13,
        type: 'number',
      }),
    ];
  }

  async processString(input) {
    const rawRotation = this.getConfig('rotation')?.value ?? 13;
    const rotation = Number(rawRotation);
    if (!Number.isInteger(rotation) || rotation < 0 || rotation > 25) {
      throw new PipeError('Rotation must be an integer between 0 and 25');
    }
    let out = '';
    for (const ch of input) {
      if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
        out += rotateLetter(ch, rotation);
      } else {
        out += ch;
      }
    }
    return out;
  }
}
