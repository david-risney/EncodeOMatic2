/**
 * Pipe Worker — runs pipe processing in a Web Worker thread.
 *
 * Messages received from main thread:
 *   { type: 'process', id, pipeType, configs, inputs }
 *   inputs: { portName: number[] }   (Uint8Array serialized as plain arrays)
 *
 * Messages sent back to main thread:
 *   { type: 'result', id, outputs, errors }
 *   outputs: { portName: number[] }
 *   errors: { message, selections }[]
 *
 * Using importScripts-style dynamic import to load pipe classes.
 */

// Import all pipe classes available in this worker
import { InputPipe }        from '../pipes/builtin/input-pipe.js';
import { Base64EncodePipe, Base64DecodePipe } from '../pipes/builtin/encoding/base64.js';
import { PercentEncodePipe, PercentDecodePipe } from '../pipes/builtin/encoding/percent.js';
import {
  QuotedPrintableEncodePipe,
  QuotedPrintableDecodePipe,
} from '../pipes/builtin/encoding/quoted-printable.js';
import { HexEncodePipe, HexDecodePipe }    from '../pipes/builtin/encoding/hex.js';
import { HtmlEncodePipe, HtmlDecodePipe }  from '../pipes/builtin/encoding/html-encode.js';
import { XmlEncodePipe, XmlDecodePipe }    from '../pipes/builtin/encoding/xml-encode.js';
import { CharsetDecodePipe, CharsetEncodePipe } from '../pipes/builtin/encoding/charset.js';
import { BinaryEncodePipe, BinaryDecodePipe }   from '../pipes/builtin/encoding/binary.js';
import { SlashEscapePipe, SlashUnescapePipe }   from '../pipes/builtin/encoding/slash-escape.js';
import { UrlEncodePipe, UrlDecodePipe }    from '../pipes/builtin/encoding/url-encode.js';
import { RotPipe }                         from '../pipes/builtin/encoding/rot.js';
import { MorseEncodePipe, MorseDecodePipe } from '../pipes/builtin/encoding/morse.js';
import { Base64urlEncodePipe, Base64urlDecodePipe } from '../pipes/builtin/encoding/base64url.js';
import { Base32EncodePipe, Base32DecodePipe }   from '../pipes/builtin/encoding/base32.js';
import { Base58EncodePipe, Base58DecodePipe }   from '../pipes/builtin/encoding/base58.js';
import { Ascii85EncodePipe, Ascii85DecodePipe } from '../pipes/builtin/encoding/ascii85.js';
import { GzipCompressPipe, GzipDecompressPipe, DeflateCompressPipe, DeflateDecompressPipe } from '../pipes/builtin/encoding/compression.js';
import { FormUrlencodedEncodePipe, FormUrlencodedDecodePipe } from '../pipes/builtin/encoding/form-urlencoded.js';
import { HmacPipe }                        from '../pipes/builtin/encoding/hmac.js';
import { MimeHeaderDecodePipe, MimeHeaderEncodePipe } from '../pipes/builtin/encoding/mime-header.js';
import { ShaHashPipe, Sha3HashPipe, KeccakHashPipe } from '../pipes/builtin/encoding/sha-hash.js';
import {
  Md4HashPipe,
  Md5HashPipe,
  Ripemd160HashPipe,
  Sm3HashPipe,
  WhirlpoolHashPipe,
} from '../pipes/builtin/encoding/md5.js';
import { Blake2bHashPipe, Blake2sHashPipe, Blake3HashPipe } from '../pipes/builtin/encoding/blake.js';
import { Crc32Pipe, Crc32cPipe, Crc64Pipe, Adler32Pipe } from '../pipes/builtin/encoding/crc32.js';
import { XxHash32Pipe, XxHash64Pipe, XxHash3Pipe, XxHash128Pipe } from '../pipes/builtin/encoding/xxhash.js';
import { JavaScriptEscapeEncodePipe, JavaScriptEscapeDecodePipe } from '../pipes/builtin/encoding/javascript-escape.js';
import { UnicodeNormalizePipe }            from '../pipes/builtin/encoding/unicode-normalize.js';
import { PunycodeEncodePipe, PunycodeDecodePipe } from '../pipes/builtin/encoding/punycode.js';
import { CssEscapePipe, CssUnescapePipe }  from '../pipes/builtin/encoding/css-escape.js';
import { CharWidthToHalfwidthPipe, CharWidthToFullwidthPipe } from '../pipes/builtin/encoding/char-width.js';
import { StringReversePipe }               from '../pipes/builtin/encoding/reverse.js';
import { CookieParserPipe }  from '../pipes/builtin/parsing/cookie-parser.js';
import { CsvParserPipe }     from '../pipes/builtin/parsing/csv-parser.js';
import { HttpRequestParserPipe }  from '../pipes/builtin/parsing/http-request-parser.js';
import { HttpResponseParserPipe } from '../pipes/builtin/parsing/http-response-parser.js';
import { JwtParserPipe }     from '../pipes/builtin/parsing/jwt-parser.js';
import { SearchParamsParserPipe } from '../pipes/builtin/parsing/search-params-parser.js';
import { UrlParserPipe }    from '../pipes/builtin/parsing/url-parser.js';
import { JsonParserPipe }   from '../pipes/builtin/parsing/json-parser.js';
import { RegexMatchPipe }   from '../pipes/builtin/parsing/regex-match.js';
import { AbnfParserPipe }    from '../pipes/builtin/parsing/abnf-parser.js';
import { NearleyParserPipe } from '../pipes/builtin/parsing/nearley-parser.js';
import { PegParserPipe }     from '../pipes/builtin/parsing/peg-parser.js';

const REGISTRY = new Map([
  ['InputPipe',       InputPipe],
  ['Base64Encode',    Base64EncodePipe],
  ['Base64Decode',    Base64DecodePipe],
  ['Base64urlEncode', Base64urlEncodePipe],
  ['Base64urlDecode', Base64urlDecodePipe],
  ['Base32Encode',    Base32EncodePipe],
  ['Base32Decode',    Base32DecodePipe],
  ['Base58Encode',    Base58EncodePipe],
  ['Base58Decode',    Base58DecodePipe],
  ['Ascii85Encode',   Ascii85EncodePipe],
  ['Ascii85Decode',   Ascii85DecodePipe],
  ['PercentEncode',   PercentEncodePipe],
  ['PercentDecode',   PercentDecodePipe],
  ['QuotedPrintableEncode', QuotedPrintableEncodePipe],
  ['QuotedPrintableDecode', QuotedPrintableDecodePipe],
  ['HexEncode',       HexEncodePipe],
  ['HexDecode',       HexDecodePipe],
  ['HtmlEncode',      HtmlEncodePipe],
  ['HtmlDecode',      HtmlDecodePipe],
  ['XmlEncode',       XmlEncodePipe],
  ['XmlDecode',       XmlDecodePipe],
  ['CharsetDecode',   CharsetDecodePipe],
  ['CharsetEncode',   CharsetEncodePipe],
  ['BinaryEncode',    BinaryEncodePipe],
  ['BinaryDecode',    BinaryDecodePipe],
  ['SlashEscape',     SlashEscapePipe],
  ['SlashUnescape',   SlashUnescapePipe],
  ['CssEscape',       CssEscapePipe],
  ['CssUnescape',     CssUnescapePipe],
  ['UrlEncode',       UrlEncodePipe],
  ['UrlDecode',       UrlDecodePipe],
  ['Rot',             RotPipe],
  ['MorseEncode',     MorseEncodePipe],
  ['MorseDecode',     MorseDecodePipe],
  ['GzipCompress',    GzipCompressPipe],
  ['GzipDecompress',  GzipDecompressPipe],
  ['DeflateCompress', DeflateCompressPipe],
  ['DeflateDecompress', DeflateDecompressPipe],
  ['FormUrlencodedEncode', FormUrlencodedEncodePipe],
  ['FormUrlencodedDecode', FormUrlencodedDecodePipe],
  ['Hmac',            HmacPipe],
  ['MimeHeaderDecode', MimeHeaderDecodePipe],
  ['MimeHeaderEncode', MimeHeaderEncodePipe],
  ['ShaHash',         ShaHashPipe],
  ['Sha3Hash',        Sha3HashPipe],
  ['KeccakHash',      KeccakHashPipe],
  ['Blake2bHash',     Blake2bHashPipe],
  ['Blake2sHash',     Blake2sHashPipe],
  ['Blake3Hash',      Blake3HashPipe],
  ['Md4Hash',         Md4HashPipe],
  ['Md5Hash',         Md5HashPipe],
  ['Ripemd160Hash',   Ripemd160HashPipe],
  ['Sm3Hash',         Sm3HashPipe],
  ['WhirlpoolHash',   WhirlpoolHashPipe],
  ['Crc32',           Crc32Pipe],
  ['Crc32c',          Crc32cPipe],
  ['Crc64',           Crc64Pipe],
  ['Adler32',         Adler32Pipe],
  ['XxHash32',        XxHash32Pipe],
  ['XxHash64',        XxHash64Pipe],
  ['XxHash3',         XxHash3Pipe],
  ['XxHash128',       XxHash128Pipe],
  ['JavaScriptEscapeEncode', JavaScriptEscapeEncodePipe],
  ['JavaScriptEscapeDecode', JavaScriptEscapeDecodePipe],
  ['UnicodeNormalize', UnicodeNormalizePipe],
  ['PunycodeEncode',  PunycodeEncodePipe],
  ['PunycodeDecode',  PunycodeDecodePipe],
  ['CharWidthToHalfwidth', CharWidthToHalfwidthPipe],
  ['CharWidthToFullwidth', CharWidthToFullwidthPipe],
  ['StringReverse',   StringReversePipe],
  ['UrlParser',       UrlParserPipe],
  ['JsonParser',      JsonParserPipe],
  ['RegexMatch',      RegexMatchPipe],
  ['CookieParser',    CookieParserPipe],
  ['CsvParser',       CsvParserPipe],
  ['HttpRequestParser', HttpRequestParserPipe],
  ['HttpResponseParser', HttpResponseParserPipe],
  ['JwtParser',       JwtParserPipe],
  ['SearchParamsParser', SearchParamsParserPipe],
  ['AbnfParser',      AbnfParserPipe],
  ['NearleyParser',   NearleyParserPipe],
  ['PegParser',       PegParserPipe],
]);

self.onmessage = async ({ data }) => {
  if (data.type !== 'process') return;

  const { id, pipeType, configs, inputs } = data;

  const PipeClass = REGISTRY.get(pipeType);
  // Validate that PipeClass is a known, safe constructor from our registry
  // before instantiating it. This prevents unexpected dispatch if somehow
  // the registry is bypassed.
  if (typeof PipeClass !== 'function') {
    self.postMessage({
      type: 'result',
      id,
      outputs: {},
      errors: [{ message: `Unknown pipe type: ${String(pipeType).slice(0, 64)}`, selections: [] }],
    });
    return;
  }

  const pipe = new PipeClass();

  // Restore configs
  for (const [name, value] of Object.entries(configs ?? {})) {
    pipe.setConfig(name, value);
  }

  // Restore inputs (plain arrays → Uint8Array)
  const inputMap = new Map();
  for (const [portName, arr] of Object.entries(inputs ?? {})) {
    inputMap.set(portName, arr === null ? null : new Uint8Array(arr));
  }

  pipe._inputData = inputMap;
  await pipe.run();

  // Serialize outputs (Uint8Array → plain array for structured clone)
  const outputs = {};
  for (const [portName, data] of pipe._outputData) {
    outputs[portName] = data ? [...data] : null;
  }

  const errors = pipe.errors.map(e => ({
    message: e.message,
    selections: e.selections ?? [],
  }));

  // Return dynamic output port definitions so main thread can sync them
  const dynamicOutputPorts = pipe._dynamicOutputs
    ? pipe._dynamicOutputs.map(p => ({ name: p.name, description: p.description }))
    : null;

  self.postMessage({ type: 'result', id, outputs, errors, dynamicOutputPorts });
};
