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
import { HexEncodePipe, HexDecodePipe }    from '../pipes/builtin/encoding/hex.js';
import { HtmlEncodePipe, HtmlDecodePipe }  from '../pipes/builtin/encoding/html-encode.js';
import { XmlEncodePipe, XmlDecodePipe }    from '../pipes/builtin/encoding/xml-encode.js';
import { CharsetDecodePipe, CharsetEncodePipe } from '../pipes/builtin/encoding/charset.js';
import { BinaryEncodePipe, BinaryDecodePipe }   from '../pipes/builtin/encoding/binary.js';
import { SlashEscapePipe, SlashUnescapePipe }   from '../pipes/builtin/encoding/slash-escape.js';
import { UrlEncodePipe, UrlDecodePipe }    from '../pipes/builtin/encoding/url-encode.js';
import { RotPipe }                         from '../pipes/builtin/encoding/rot.js';
import { UrlParserPipe }    from '../pipes/builtin/parsing/url-parser.js';
import { JsonParserPipe }   from '../pipes/builtin/parsing/json-parser.js';
import { RegexMatchPipe }   from '../pipes/builtin/parsing/regex-match.js';

const REGISTRY = new Map([
  ['InputPipe',       InputPipe],
  ['Base64Encode',    Base64EncodePipe],
  ['Base64Decode',    Base64DecodePipe],
  ['PercentEncode',   PercentEncodePipe],
  ['PercentDecode',   PercentDecodePipe],
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
  ['UrlEncode',       UrlEncodePipe],
  ['UrlDecode',       UrlDecodePipe],
  ['Rot',             RotPipe],
  ['UrlParser',       UrlParserPipe],
  ['JsonParser',      JsonParserPipe],
  ['RegexMatch',      RegexMatchPipe],
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
