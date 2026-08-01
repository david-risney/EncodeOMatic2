import { builtinPipes as urlParserPipes } from './url-parser.js';
import { builtinPipes as jsonParserPipes } from './json-parser.js';
import { builtinPipes as regexMatchPipes } from './regex-match.js';
import { builtinPipes as cookieParserPipes } from './cookie-parser.js';
import { builtinPipes as csvParserPipes } from './csv-parser.js';
import { builtinPipes as httpRequestParserPipes } from './http-request-parser.js';
import { builtinPipes as httpResponseParserPipes } from './http-response-parser.js';
import { builtinPipes as jwtParserPipes } from './jwt-parser.js';
import { builtinPipes as searchParamsParserPipes } from './search-params-parser.js';
import { builtinPipes as abnfParserPipes } from './abnf-parser.js';
import { builtinPipes as nearleyParserPipes } from './nearley-parser.js';
import { builtinPipes as pegParserPipes } from './peg-parser.js';
import { builtinPipes as protobufParserPipes } from './protobuf-parser.js';
import { builtinPipes as asn1ParserPipes } from './asn1-parser.js';

export const builtinParsingPipes = [
  ...urlParserPipes,
  ...jsonParserPipes,
  ...regexMatchPipes,
  ...cookieParserPipes,
  ...csvParserPipes,
  ...httpRequestParserPipes,
  ...httpResponseParserPipes,
  ...jwtParserPipes,
  ...searchParamsParserPipes,
  ...abnfParserPipes,
  ...nearleyParserPipes,
  ...pegParserPipes,
  ...protobufParserPipes,
  ...asn1ParserPipes,
];
