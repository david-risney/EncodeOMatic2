import { builtinPipes as base64Pipes } from './base64.js';
import { builtinPipes as base64urlPipes } from './base64url.js';
import { builtinPipes as base32Pipes } from './base32.js';
import { builtinPipes as base58Pipes } from './base58.js';
import { builtinPipes as ascii85Pipes } from './ascii85.js';
import { builtinPipes as percentPipes } from './percent.js';
import { builtinPipes as quotedPrintablePipes } from './quoted-printable.js';
import { builtinPipes as hexPipes } from './hex.js';
import { builtinPipes as htmlEncodePipes } from './html-encode.js';
import { builtinPipes as xmlEncodePipes } from './xml-encode.js';
import { builtinPipes as charsetPipes } from './charset.js';
import { builtinPipes as binaryPipes } from './binary.js';
import { builtinPipes as slashEscapePipes } from './slash-escape.js';
import { builtinPipes as cssEscapePipes } from './css-escape.js';
import { builtinPipes as urlEncodePipes } from './url-encode.js';
import { builtinPipes as rotPipes } from './rot.js';
import { builtinPipes as morsePipes } from './morse.js';
import { builtinPipes as compressionPipes } from './compression.js';
import { builtinPipes as formUrlencodedPipes } from './form-urlencoded.js';
import { builtinPipes as hmacPipes } from './hmac.js';
import { builtinPipes as mimeHeaderPipes } from './mime-header.js';
import { builtinPipes as shaHashPipes } from './sha-hash.js';
import { builtinPipes as blakePipes } from './blake.js';
import { builtinPipes as md5Pipes } from './md5.js';
import { builtinPipes as crc32Pipes } from './crc32.js';
import { builtinPipes as xxhashPipes } from './xxhash.js';
import { builtinPipes as unicodeEscapePipes } from './unicode-escape.js';
import { builtinPipes as unicodeNormalizePipes } from './unicode-normalize.js';
import { builtinPipes as punycodePipes } from './punycode.js';
import { builtinPipes as charWidthPipes } from './char-width.js';
import { builtinPipes as reversePipes } from './reverse.js';

export const builtinEncodingPipes = [
  ...base64Pipes,
  ...base64urlPipes,
  ...base32Pipes,
  ...base58Pipes,
  ...ascii85Pipes,
  ...percentPipes,
  ...quotedPrintablePipes,
  ...hexPipes,
  ...htmlEncodePipes,
  ...xmlEncodePipes,
  ...charsetPipes,
  ...binaryPipes,
  ...slashEscapePipes,
  ...cssEscapePipes,
  ...urlEncodePipes,
  ...rotPipes,
  ...morsePipes,
  ...compressionPipes,
  ...formUrlencodedPipes,
  ...hmacPipes,
  ...mimeHeaderPipes,
  ...shaHashPipes,
  ...blakePipes,
  ...md5Pipes,
  ...crc32Pipes,
  ...xxhashPipes,
  ...unicodeEscapePipes,
  ...unicodeNormalizePipes,
  ...punycodePipes,
  ...charWidthPipes,
  ...reversePipes,
];
