import { describe, expect, it } from 'vitest';
import { ProtobufParserPipe } from '../src/pipes/builtin/parsing/protobuf-parser.js';
import { encode, decode } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SIMPLE_SCHEMA = `
syntax = "proto3";
message Person {
  string name = 1;
  int32 age = 2;
}
`;

const NESTED_SCHEMA = `
syntax = "proto3";
message Address {
  string street = 1;
  string city = 2;
}
message Person {
  string name = 1;
  int32 age = 2;
  Address address = 3;
}
`;

const PACKAGED_SCHEMA = `
syntax = "proto3";
package example;
message Greeting {
  string message = 1;
}
`;

function inputs(inputBytes, schemaText) {
  return new Map([
    ['input',  inputBytes],
    ['schema', encode(schemaText)],
  ]);
}

function encodeProto(schemaText, messageName, obj) {
  // Build reference bytes using the same library
  const { protobuf } = require('../vendor/protobufjs.js');
  const root = protobuf.parse(schemaText, { keepCase: true }).root;
  root.resolveAll();
  const T = root.lookupType(messageName);
  return T.encode(T.create(obj)).finish();
}

// Pre-build known binary fixtures using Node.js for determinism
// bytes for Person { name: "Alice", age: 30 }
// field 1 (name, wire type 2): 0x0a 0x05 "Alice"  → [10, 5, 65, 108, 105, 99, 101]
// field 2 (age, wire type 0):  0x10 0x1e            → [16, 30]
const ALICE_BYTES = new Uint8Array([10, 5, 65, 108, 105, 99, 101, 16, 30]);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProtobufParserPipe', () => {
  it('has expected static metadata', () => {
    expect(ProtobufParserPipe.typeName).toBe('ProtobufParser');
    expect(ProtobufParserPipe.category).toBe('Format');
  });

  it('has schema and input ports', () => {
    const pipe = new ProtobufParserPipe();
    const names = pipe.defineInputs().map(p => p.name);
    expect(names).toContain('schema');
    expect(names).toContain('input');
    expect(pipe.defineInputs().find(p => p.isDefault)?.name).toBe('input');
  });

  it('has json as default output', () => {
    const pipe = new ProtobufParserPipe();
    expect(pipe.defineOutputs().find(p => p.isDefault)?.name).toBe('json');
  });

  it('has binary and json outputs', () => {
    const pipe = new ProtobufParserPipe();
    const names = pipe.defineOutputs().map(p => p.name);
    expect(names).toContain('json');
    expect(names).toContain('binary');
  });

  it('has messageName and mode configs', () => {
    const pipe = new ProtobufParserPipe();
    expect(pipe.getConfig('messageName')).toBeTruthy();
    expect(pipe.getConfig('mode')).toBeTruthy();
    expect(pipe.getConfig('mode').value).toBe('decode');
  });

  // ─── decode mode ──────────────────────────────────────────────────────────

  it('decodes binary protobuf to JSON', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    const result = await pipe.process(inputs(ALICE_BYTES, SIMPLE_SCHEMA));
    const json = JSON.parse(decode(result.get('json')));
    expect(json.name).toBe('Alice');
    expect(json.age).toBe(30);
  });

  it('exposes top-level fields as dynamic field: outputs', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    const result = await pipe.process(inputs(ALICE_BYTES, SIMPLE_SCHEMA));
    expect(decode(result.get('field:name'))).toBe('Alice');
    expect(decode(result.get('field:age'))).toBe('30');
    const outNames = pipe.defineOutputs().map(p => p.name);
    expect(outNames).toContain('field:name');
    expect(outNames).toContain('field:age');
  });

  it('serialises nested objects as JSON in field outputs', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    // Encode Person with an Address using the library
    const { protobuf } = await import('../vendor/protobufjs.js');
    const root = protobuf.parse(NESTED_SCHEMA, { keepCase: true }).root;
    root.resolveAll();
    const T = root.lookupType('Person');
    const buf = T.encode(T.create({ name: 'Bob', age: 25, address: { street: '1 Main St', city: 'Springfield' } })).finish();
    const result = await pipe.process(inputs(buf, NESTED_SCHEMA));
    const addrField = JSON.parse(decode(result.get('field:address')));
    expect(addrField.street).toBe('1 Main St');
    expect(addrField.city).toBe('Springfield');
  });

  it('resolves package-qualified message names', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'example.Greeting');
    const { protobuf } = await import('../vendor/protobufjs.js');
    const root = protobuf.parse(PACKAGED_SCHEMA, { keepCase: true }).root;
    root.resolveAll();
    const T = root.lookupType('example.Greeting');
    const buf = T.encode(T.create({ message: 'hello' })).finish();
    const result = await pipe.process(inputs(buf, PACKAGED_SCHEMA));
    const json = JSON.parse(decode(result.get('json')));
    expect(json.message).toBe('hello');
  });

  it('rebuilds dynamic field outputs between runs', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    await pipe.process(inputs(ALICE_BYTES, SIMPLE_SCHEMA));
    // Run with an empty message (all defaults, so still has field ports)
    const empty = new Uint8Array(0);
    await pipe.process(inputs(ALICE_BYTES, SIMPLE_SCHEMA));
    const names = pipe.defineOutputs().map(p => p.name);
    expect(names).toContain('field:name');
  });

  it('throws PipeError for empty schema', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    await expect(pipe.process(inputs(ALICE_BYTES, ''))).rejects
      .toMatchObject({ message: 'Schema input is empty' });
  });

  it('throws PipeError for invalid schema', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    await expect(pipe.process(inputs(ALICE_BYTES, 'not a valid proto'))).rejects
      .toMatchObject({ message: expect.stringContaining('Proto schema error') });
  });

  it('throws PipeError when messageName is empty', async () => {
    const pipe = new ProtobufParserPipe();
    await expect(pipe.process(inputs(ALICE_BYTES, SIMPLE_SCHEMA))).rejects
      .toMatchObject({ message: 'messageName config is required' });
  });

  it('throws PipeError for unknown message type', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'NoSuchMessage');
    await expect(pipe.process(inputs(ALICE_BYTES, SIMPLE_SCHEMA))).rejects
      .toMatchObject({ message: expect.stringContaining('"NoSuchMessage"') });
  });

  it('throws PipeError for empty input in decode mode', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    await expect(pipe.process(inputs(new Uint8Array(0), SIMPLE_SCHEMA))).rejects
      .toMatchObject({ message: 'Input is empty' });
  });

  // ─── encode mode ──────────────────────────────────────────────────────────

  it('encodes JSON to binary protobuf', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    pipe.setConfig('mode', 'encode');
    const json = JSON.stringify({ name: 'Alice', age: 30 });
    const result = await pipe.process(inputs(encode(json), SIMPLE_SCHEMA));
    expect([...result.get('binary')]).toEqual([...ALICE_BYTES]);
  });

  it('round-trips encode then decode', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    pipe.setConfig('mode', 'encode');
    const original = { name: 'Eve', age: 99 };
    const encResult = await pipe.process(inputs(encode(JSON.stringify(original)), SIMPLE_SCHEMA));
    const binary = encResult.get('binary');

    pipe.setConfig('mode', 'decode');
    const decResult = await pipe.process(inputs(binary, SIMPLE_SCHEMA));
    const decoded = JSON.parse(decode(decResult.get('json')));
    expect(decoded.name).toBe('Eve');
    expect(decoded.age).toBe(99);
  });

  it('throws PipeError for empty input in encode mode', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    pipe.setConfig('mode', 'encode');
    await expect(pipe.process(inputs(new Uint8Array(0), SIMPLE_SCHEMA))).rejects
      .toMatchObject({ message: 'Input is empty' });
  });

  it('throws PipeError for non-JSON input in encode mode', async () => {
    const pipe = new ProtobufParserPipe();
    pipe.setConfig('messageName', 'Person');
    pipe.setConfig('mode', 'encode');
    await expect(pipe.process(inputs(encode('not json'), SIMPLE_SCHEMA))).rejects
      .toMatchObject({ message: expect.stringContaining('not valid JSON') });
  });
});
