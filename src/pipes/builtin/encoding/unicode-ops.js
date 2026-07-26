/**
 * Unicode case-folding pipes.
 *
 * Provides lowercase and uppercase Unicode case-fold transforms using
 * JavaScript's Unicode-aware case mapping.
 */

import { StringPipe } from '../../string-pipe.js';

export class UnicodeCaseFoldLowerPipe extends StringPipe {
  static typeName = 'UnicodeCaseFoldLower';
  static typeDescription = 'Unicode Case Fold Lower';
  static category = 'Character Sets';
  static categoryDescription =
    'Apply Unicode lower-case folding to text (NFKC normalization + lowercase).';

  async processString(str) {
    return str.normalize('NFKC').toLowerCase();
  }
}

export class UnicodeCaseFoldUpperPipe extends StringPipe {
  static typeName = 'UnicodeCaseFoldUpper';
  static typeDescription = 'Unicode Case Fold Upper';
  static category = 'Character Sets';
  static categoryDescription =
    'Apply Unicode upper-case folding to text (NFKC normalization + uppercase).';

  async processString(str) {
    return str.normalize('NFKC').toUpperCase();
  }
}

export const builtinPipes = [UnicodeCaseFoldLowerPipe, UnicodeCaseFoldUpperPipe];
