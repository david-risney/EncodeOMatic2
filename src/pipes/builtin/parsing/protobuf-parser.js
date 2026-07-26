/**
 * Protobuf Parser pipe.
 *
 * Decodes binary Protocol Buffers data to JSON, or encodes JSON to binary
 * Protobuf, using a .proto schema supplied as a separate input.
 *
 * Inputs:
 *   - input (default)  — binary protobuf bytes (decode) or JSON text (encode)
 *   - schema           — .proto schema text
 *
 * Configs:
 *   - messageName — fully-qualified message type name to use
 *   - mode        — "decode" (binary → JSON) or "encode" (JSON → binary)
 *
 * Outputs (decode mode):
 *   - json (default) — decoded message as JSON text
 *   - field:NAME     — one dynamic port per top-level field of the decoded message
 *
 * Outputs (encode mode):
 *   - binary (default) — binary-encoded protobuf bytes
 */

import { Pipe, PortDef, PipeConfig, PipeError } from '../../pipe.js';
import { protobuf } from '../../../../vendor/protobufjs.js';

export class ProtobufParserPipe extends Pipe {
  static typeName = 'ProtobufParser';
  static typeDescription = 'Protobuf Parser';
  static category = 'Format';
  static categoryDescription = 'Decode binary Protobuf data to JSON, or encode JSON to binary Protobuf. Wire a .proto schema text to the schema input.';

  constructor() {
    super();
    this._dynamicOutputs = [];
  }

  defineInputs() {
    return [
      new PortDef('input',  'Binary protobuf bytes (decode) or JSON text (encode)', true),
      new PortDef('schema', '.proto schema text'),
    ];
  }

  defineOutputs() {
    return [
      new PortDef('json',   'Decoded message as JSON (decode mode)', true),
      new PortDef('binary', 'Binary-encoded protobuf bytes (encode mode)'),
      ...(this._dynamicOutputs ?? []),
    ];
  }

  defineConfigs() {
    return [
      new PipeConfig({
        name: 'messageName',
        description: 'Message type name to decode/encode (e.g. "MyMessage" or "pkg.MyMessage")',
        defaultValue: '',
        type: 'string',
      }),
      new PipeConfig({
        name: 'mode',
        description: 'Operation mode',
        defaultValue: 'decode',
        type: 'select',
        options: ['decode', 'encode'],
      }),
    ];
  }

  async process(inputs) {
    const enc = new TextEncoder();
    const dec = new TextDecoder('utf-8', { fatal: true });

    const schemaData = inputs.get('schema') ?? new Uint8Array(0);
    const inputData  = inputs.get('input')  ?? new Uint8Array(0);

    if (!schemaData.length) throw new PipeError('Schema input is empty');

    let schemaText;
    try { schemaText = dec.decode(schemaData).trim(); } catch { throw new PipeError('Schema is not valid UTF-8'); }

    // Parse .proto schema
    let root;
    try {
      root = protobuf.parse(schemaText, { keepCase: true }).root;
      root.resolveAll();
    } catch (e) {
      throw new PipeError(`Proto schema error: ${e.message}`);
    }

    // Resolve message type
    const messageName = (this.getConfig('messageName')?.value ?? '').trim();
    if (!messageName) throw new PipeError('messageName config is required');

    let MessageType;
    try {
      MessageType = root.lookupType(messageName);
    } catch {
      throw new PipeError(`Message type "${messageName}" not found in schema`);
    }

    const mode = this.getConfig('mode')?.value ?? 'decode';
    const out = new Map();
    this._dynamicOutputs = [];

    if (mode === 'decode') {
      if (!inputData.length) throw new PipeError('Input is empty');

      let message;
      try {
        message = MessageType.decode(inputData);
      } catch (e) {
        throw new PipeError(`Protobuf decode error: ${e.message}`);
      }

      const obj = MessageType.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
        defaults: true,
        arrays: true,
        objects: true,
        oneofs: true,
      });

      out.set('json',   enc.encode(JSON.stringify(obj, null, 2)));
      out.set('binary', new Uint8Array(0));

      // Dynamic field outputs for top-level fields
      for (const [key, val] of Object.entries(obj)) {
        const portName = `field:${key}`;
        this._dynamicOutputs.push(new PortDef(portName, `Field: ${key}`));
        if (!this._outputData.has(portName)) this._outputData.set(portName, null);
        const strVal = (typeof val === 'object' && val !== null)
          ? JSON.stringify(val, null, 2)
          : String(val ?? '');
        out.set(portName, enc.encode(strVal));
      }
    } else {
      // encode mode: JSON text → binary protobuf
      let inputText;
      try { inputText = dec.decode(inputData); } catch { throw new PipeError('Input is not valid UTF-8'); }
      if (!inputText.trim()) throw new PipeError('Input is empty');

      let jsonObj;
      try { jsonObj = JSON.parse(inputText); } catch (e) { throw new PipeError(`Input is not valid JSON: ${e.message}`); }

      const errMsg = MessageType.verify(jsonObj);
      if (errMsg) throw new PipeError(`Message verification failed: ${errMsg}`);

      let encoded;
      try {
        const message = MessageType.create(jsonObj);
        encoded = MessageType.encode(message).finish();
      } catch (e) {
        throw new PipeError(`Protobuf encode error: ${e.message}`);
      }

      out.set('json',   new Uint8Array(0));
      out.set('binary', encoded);
    }

    return out;
  }
}

export const builtinPipes = [ProtobufParserPipe];
