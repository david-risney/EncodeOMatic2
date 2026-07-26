/**
 * Morse code encode/decode pipes.
 *
 * Uses International Morse code mappings for letters, digits, and common
 * punctuation. Words are separated by "/" in encoded output.
 */

import { StringPipe } from '../../string-pipe.js';
import { PipeError } from '../../pipe.js';

const MORSE_BY_CHAR = new Map(Object.entries({
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  0: '-----',
  1: '.----',
  2: '..---',
  3: '...--',
  4: '....-',
  5: '.....',
  6: '-....',
  7: '--...',
  8: '---..',
  9: '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '\'': '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
}));

const CHAR_BY_MORSE = new Map(
  [...MORSE_BY_CHAR.entries()].map(([char, code]) => [code, char])
);

function tokenizeMorse(input) {
  return input
    .replaceAll('|', '/')
    .replaceAll('/', ' / ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export class MorseEncodePipe extends StringPipe {
  static typeName = 'MorseEncode';
  static typeDescription = 'Morse Code Encode';
  static category = 'Encoding';
  static categoryDescription = 'Encode text to International Morse code with "/" as a word separator.';

  async processString(input) {
    const trimmed = input.trim();
    if (trimmed.length === 0) return '';

    const words = trimmed.split(/\s+/);
    return words.map((word) => {
      const letters = [...word.toUpperCase()].map((char) => {
        const morse = MORSE_BY_CHAR.get(char);
        if (morse == null) {
          throw new PipeError(`Unsupported character for Morse code: ${JSON.stringify(char)}`);
        }
        return morse;
      });
      return letters.join(' ');
    }).join(' / ');
  }
}

export class MorseDecodePipe extends StringPipe {
  static typeName = 'MorseDecode';
  static typeDescription = 'Morse Code Decode';
  static category = 'Encoding';
  static categoryDescription = 'Decode International Morse code (letters separated by spaces, words by "/").';

  static getInputAppropriateness(input) {
    if (input == null || input.length === 0) return 0;

    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(input).trim();
    } catch {
      return -10;
    }
    if (text.length === 0) return 0;
    if (/[^.\-/|\s]/.test(text)) return -10;

    const tokens = tokenizeMorse(text);
    if (tokens.length === 0) return 0;

    let hasSignalToken = false;
    for (const token of tokens) {
      if (token === '/') continue;
      hasSignalToken = true;
      if (!CHAR_BY_MORSE.has(token)) return -10;
    }
    if (!hasSignalToken) return 0;

    if (tokens.includes('/')) return 8;
    if (tokens.length >= 2) return 7;
    return tokens[0].length >= 2 ? 5 : 0;
  }

  async processString(input) {
    const tokens = tokenizeMorse(input);
    if (tokens.length === 0) return '';

    const output = [];
    for (const token of tokens) {
      if (token === '/') {
        if (output.length > 0 && output[output.length - 1] !== ' ') output.push(' ');
        continue;
      }

      const char = CHAR_BY_MORSE.get(token);
      if (char == null) {
        throw new PipeError(`Invalid Morse token: ${JSON.stringify(token)}`);
      }
      output.push(char);
    }

    return output.join('').trim();
  }
}
