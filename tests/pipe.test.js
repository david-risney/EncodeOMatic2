import { describe, expect, it } from 'vitest';
import { Pipe, PipeConfig, PipeError, PortDef } from '../src/pipes/pipe.js';
import { StringPipe } from '../src/pipes/string-pipe.js';
import { decode, encode } from './helpers.js';

class TestPipe extends Pipe {
  static typeName = 'Test';
  static typeDescription = 'Test pipe';

  defineConfigs() {
    return [new PipeConfig({
      name: 'prefix',
      description: 'Prefix',
      defaultValue: '>',
      type: 'string',
    })];
  }

  async process(inputs) {
    const input = inputs.get('input') ?? new Uint8Array();
    return new Map([
      ['output', encode(this.getConfig('prefix').value + decode(input))],
      ['unknown', encode('ignored')],
    ]);
  }
}

describe('pipe model', () => {
  it('stores configuration, errors, ports, and defaults', () => {
    const config = new PipeConfig({
      name: 'x', description: 'X', defaultValue: 1, type: 'number', options: ['1'],
    });
    const error = new PipeError('bad', [{ index: 2, length: 1 }]);
    const port = new PortDef('p', 'Port', true);

    expect(config.toJSON()).toEqual({ name: 'x', value: 1 });
    expect(error).toMatchObject({ message: 'bad', selections: [{ index: 2, length: 1 }] });
    expect(port).toMatchObject({ name: 'p', description: 'Port', isDefault: true });
  });

  it('runs, clears stale outputs, and serializes state', async () => {
    const pipe = new TestPipe();
    pipe.position = { x: 3, y: 4 };
    pipe.setConfig('prefix', '!');
    pipe.setConfig('missing', 'ignored');
    pipe.setInputData('input', encode('hello'));
    await pipe.run();

    expect(decode(pipe.getInputData())).toBe('hello');
    expect(decode(pipe.getOutputData())).toBe('!hello');
    expect(pipe.getOutputData('unknown')).toBeNull();
    expect(pipe.errors).toEqual([]);
    expect(pipe.displayName).toBe('Test pipe');
    expect(pipe.typeName).toBe('Test');
    expect(pipe.toJSON()).toMatchObject({
      type: 'Test', configs: { prefix: '!' }, position: { x: 3, y: 4 },
    });

    pipe.fromJSON({ id: 'restored', position: { x: 8, y: 9 }, configs: { prefix: '#' } });
    expect(pipe.id).toBe('restored');
    expect(pipe.position).toEqual({ x: 8, y: 9 });
    expect(pipe.getConfig('prefix').value).toBe('#');
  });

  it('converts thrown values into PipeError and clears output', async () => {
    class BrokenPipe extends Pipe {
      async process() {
        throw new Error('broken');
      }
    }
    const pipe = new BrokenPipe();
    pipe._outputData.set('output', encode('stale'));
    await pipe.run();
    expect(pipe.getOutputData()).toBeNull();
    expect(pipe.errors[0]).toBeInstanceOf(PipeError);
    expect(pipe.errors[0].message).toBe('broken');
    await expect(pipe.process(new Map())).rejects.toThrow('broken');
  });

  it('uses first ports and safe fallbacks when no default is declared', () => {
    class OddPipe extends Pipe {
      defineInputs() { return [new PortDef('first', '')]; }
      defineOutputs() { return []; }
    }
    const pipe = new OddPipe();
    expect(pipe.defaultInputName).toBe('first');
    expect(pipe.defaultOutputName).toBe('output');
  });
});

describe('StringPipe', () => {
  class UpperPipe extends StringPipe {
    async processString(input) { return input.toUpperCase(); }
  }

  it('decodes, transforms, and encodes UTF-8 strings', async () => {
    const pipe = new UpperPipe();
    const output = await pipe.process(new Map([['input', encode('héllo')]]));
    expect(decode(output.get('output'))).toBe('HÉLLO');
    expect(pipe.getConfig('encoding').options).toContain('utf-16le');
  });

  it('reports invalid input for fatal decoding', async () => {
    const pipe = new UpperPipe();
    await expect(pipe.process(new Map([['input', Uint8Array.of(0xff)]])))
      .rejects.toMatchObject({ message: 'Cannot decode input bytes as utf-8' });
  });

  it('requires subclasses to implement string processing', async () => {
    await expect(new StringPipe().processString('x')).rejects.toThrow('not implemented');
  });
});
