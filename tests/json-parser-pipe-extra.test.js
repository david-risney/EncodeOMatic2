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

  describe('paths config', () => {
    const json = JSON.stringify({
      user: { name: 'Alice', age: 30 },
      tags: ['a', 'b', 'c'],
      count: 42,
    });

    it('exposes configured dot-notation paths as path: ports', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', 'user.name,count');
      const result = await pipe.process(new Map([['input', encode(json)]]));

      expect(decode(result.get('path:user.name'))).toBe('Alice');
      expect(decode(result.get('path:count'))).toBe('42');
      expect(pipe.defineOutputs().map(({ name }) => name)).toContain('path:user.name');
      expect(pipe.defineOutputs().map(({ name }) => name)).toContain('path:count');
    });

    it('exposes array-bracket paths', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', 'tags[0],tags[2]');
      const result = await pipe.process(new Map([['input', encode(json)]]));

      expect(decode(result.get('path:tags[0]'))).toBe('a');
      expect(decode(result.get('path:tags[2]'))).toBe('c');
    });

    it('exposes mixed dot and bracket paths', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', 'user.age,tags[1]');
      const result = await pipe.process(new Map([['input', encode(json)]]));

      expect(decode(result.get('path:user.age'))).toBe('30');
      expect(decode(result.get('path:tags[1]'))).toBe('b');
    });

    it('returns empty string for missing paths', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', 'does.not.exist,tags[99]');
      const result = await pipe.process(new Map([['input', encode(json)]]));

      expect(decode(result.get('path:does.not.exist'))).toBe('');
      expect(decode(result.get('path:tags[99]'))).toBe('');
    });

    it('suppresses top-level key: ports when paths is set', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', 'count');
      await pipe.process(new Map([['input', encode(json)]]));
      const names = pipe.defineOutputs().map(({ name }) => name);

      expect(names).not.toContain('key:user');
      expect(names).not.toContain('key:count');
      expect(names).toContain('path:count');
    });

    it('still exposes top-level key: ports when paths is empty', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', '');
      await pipe.process(new Map([['input', encode(json)]]));
      const names = pipe.defineOutputs().map(({ name }) => name);

      expect(names).toContain('key:user');
      expect(names).toContain('key:tags');
      expect(names).toContain('key:count');
    });

    it('ignores blank segments in comma-delimited paths', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', ' , count , ');
      const result = await pipe.process(new Map([['input', encode(json)]]));
      const names = pipe.defineOutputs().map(({ name }) => name);

      expect(names).toEqual(['json', 'path:count']);
      expect(decode(result.get('path:count'))).toBe('42');
    });

    it('serialises non-string path values as JSON', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', 'user,tags');
      const result = await pipe.process(new Map([['input', encode(json)]]));

      expect(decode(result.get('path:user'))).toBe('{"name":"Alice","age":30}');
      expect(decode(result.get('path:tags'))).toBe('["a","b","c"]');
    });

    it('rebuilds path: ports across successive runs', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', 'count');

      await pipe.process(new Map([['input', encode(json)]]));
      expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json', 'path:count']);

      pipe.setConfig('paths', 'user.name');
      await pipe.process(new Map([['input', encode(json)]]));
      expect(pipe.defineOutputs().map(({ name }) => name)).toEqual(['json', 'path:user.name']);
    });

    it('works on array root values', async () => {
      const pipe = new JsonParserPipe();
      pipe.setConfig('paths', '[0],[2]');
      const result = await pipe.process(new Map([['input', encode('["x","y","z"]')]]));

      expect(decode(result.get('path:[0]'))).toBe('x');
      expect(decode(result.get('path:[2]'))).toBe('z');
    });
  });
});
