import { describe, expect, it } from 'vitest';

import { PipeError } from '../src/pipes/pipe.js';
import { JsonParserPipe } from '../src/pipes/builtin/parsing/json-parser.js';
import { decode, encode } from './helpers.js';

describe('JsonParserPipe extra coverage', () => {
  it('rejects empty and whitespace-only input', async () => {
    await expect(new JsonParserPipe().process(new Map([['input', encode('')]]))).rejects
      .toBeInstanceOf(PipeError);
    await expect(new JsonParserPipe().process(new Map([['input', encode(' \n\t ')]]))).rejects
      .toBeInstanceOf(PipeError);
  });

  it('stringifies scalar and structured top-level object values on key outputs', async () => {
    const pipe = new JsonParserPipe();
    const result = await pipe.process(new Map([['input', encode(JSON.stringify({
      trueVal: true,
      falseVal: false,
      arrayVal: [1, 2, 3],
      nullVal: null,
      zeroVal: 0,
      negativeVal: -12,
      floatVal: 1.25,
      emptyString: '',
      nestedVal: { ok: true, count: 2 },
      expVal: 1e5,
    }))]]));

    expect(decode(result.get('key:trueVal'))).toBe('true');
    expect(decode(result.get('key:falseVal'))).toBe('false');
    expect(decode(result.get('key:arrayVal'))).toBe('[1,2,3]');
    expect(decode(result.get('key:nullVal'))).toBe('null');
    expect(decode(result.get('key:zeroVal'))).toBe('0');
    expect(decode(result.get('key:negativeVal'))).toBe('-12');
    expect(decode(result.get('key:floatVal'))).toBe('1.25');
    expect(decode(result.get('key:emptyString'))).toBe('');
    expect(decode(result.get('key:nestedVal'))).toBe('{"ok":true,"count":2}');
    expect(decode(result.get('key:expVal'))).toBe('100000');
  });

  it('preserves non-ASCII strings and normalizes unicode escapes', async () => {
    const pipe = new JsonParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('{"raw":"héllo 🌍","escaped":"\\u2603","emoji":"\\ud83d\\ude00"}')
    ]]));

    expect(decode(result.get('key:raw'))).toBe('héllo 🌍');
    expect(decode(result.get('key:escaped'))).toBe('☃');
    expect(decode(result.get('key:emoji'))).toBe('😀');
    expect(decode(result.get('json'))).toContain('"escaped": "☃"');
  });

  it('supports special key names including blanks, whitespace, and numeric strings', async () => {
    const pipe = new JsonParserPipe();
    const result = await pipe.process(new Map([['input',
      encode('{"":"blank"," ":"space","0":"zero","1":1}')
    ]]));

    expect(decode(result.get('key:'))).toBe('blank');
    expect(decode(result.get('key: '))).toBe('space');
    expect(decode(result.get('key:0'))).toBe('zero');
    expect(decode(result.get('key:1'))).toBe('1');
  });

  it('rebuilds and clears dynamic outputs across successive runs', async () => {
    const pipe = new JsonParserPipe();

    await pipe.process(new Map([['input', encode('{"old":1,"shared":2}')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json', 'key:old', 'key:shared']);

    await pipe.process(new Map([['input', encode('{"new":3}')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json', 'key:new']);

    await pipe.process(new Map([['input', encode('[1,2,3]')]]));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json']);
  });

  it('creates dynamic outputs for large objects', async () => {
    const pipe = new JsonParserPipe();
    const largeObject = Object.fromEntries(
      Array.from({ length: 128 }, (_, index) => [`key-${index}`, index])
    );
    const result = await pipe.process(new Map([['input', encode(JSON.stringify(largeObject))]]));
    const outputNames = pipe.defineOutputs().map(({ name }) => name);

    expect(outputNames).toHaveLength(129);
    for (let index = 0; index < 128; index += 1) {
      expect(outputNames).toContain(`key:key-${index}`);
      expect(decode(result.get(`key:key-${index}`))).toBe(String(index));
    }
  });

  it('handles deeply nested objects without crashing', async () => {
    const pipe = new JsonParserPipe();
    let nested = { done: true };
    for (let index = 0; index < 200; index += 1) {
      nested = { level: index, child: nested };
    }

    const result = await pipe.process(new Map([['input',
      encode(JSON.stringify({ root: nested }))
    ]]));

    expect(decode(result.get('key:root'))).toBe(JSON.stringify(nested));
    expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json', 'key:root']);
  });

  it('reports invalid input through run() and clears outputs', async () => {
    const pipe = new JsonParserPipe();

    pipe.setInputData('input', encode('{"a":1}'));
    await pipe.run();
    expect(decode(pipe.getOutputData('json'))).toContain('"a": 1');

    pipe.setInputData('input', encode('{'));
    await pipe.run();

    expect(pipe.getOutputData('json')).toBeNull();
    expect(pipe.getOutputData('key:a')).toBeNull();
    expect(pipe.errors).toHaveLength(1);
    expect(pipe.errors[0]).toBeInstanceOf(PipeError);
    expect(pipe.errors[0].message).toContain('Invalid JSON:');
  });

  it('scores null, empty, whitespace, valid, and invalid input appropriately', () => {
    expect(JsonParserPipe.getInputAppropriateness(null)).toBe(0);
    expect(JsonParserPipe.getInputAppropriateness(new Uint8Array())).toBe(0);
    expect(JsonParserPipe.getInputAppropriateness(encode(' \n\t '))).toBe(0);
    expect(JsonParserPipe.getInputAppropriateness(encode('{"ok":true}'))).toBe(10);
    expect(JsonParserPipe.getInputAppropriateness(encode('not json'))).toBe(-10);
  });
});
