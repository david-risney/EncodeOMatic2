import { builtinPipes as inputPipes } from './input-pipe.js';
import { builtinPipes as fileInputPipes } from './file-input-pipe.js';
import { builtinEncodingPipes } from './encoding/index.js';
import { builtinParsingPipes } from './parsing/index.js';

export const builtinPipes = [
  ...inputPipes,
  ...fileInputPipes,
  ...builtinEncodingPipes,
  ...builtinParsingPipes,
];
