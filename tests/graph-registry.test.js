import { describe, expect, it, vi } from 'vitest';
import { Pipe, PortDef } from '../src/pipes/pipe.js';
import { Connection, PipeGraph } from '../src/pipes/graph.js';
import { createPipe, getPipesByCategory, registry } from '../src/pipes/registry.js';
import { InputPipe } from '../src/pipes/builtin/input-pipe.js';
import { HexEncodePipe } from '../src/pipes/builtin/encoding/hex.js';
import { UrlParserPipe } from '../src/pipes/builtin/parsing/url-parser.js';
import { decode, encode } from './helpers.js';

class PassPipe extends Pipe {
  static typeName = 'Pass';
  async process(inputs) {
    return new Map([['output', inputs.get('input') ?? new Uint8Array()]]);
  }
}

describe('Connection', () => {
  it('has a stable identifier and serializes endpoints', () => {
    const connection = new Connection('a', 'out', 'b', 'in');
    expect(connection.id).toBe('conn-a:out->b:in');
    expect(connection.toJSON()).toEqual({
      fromPipeId: 'a', fromOutput: 'out', toPipeId: 'b', toInput: 'in',
    });
  });
});

describe('PipeGraph mutation and traversal', () => {
  it('adds, replaces, queries, disconnects, and removes connections', () => {
    const graph = new PipeGraph();
    const events = [];
    graph.addListener((event) => events.push(event.type));
    const a = new PassPipe();
    const b = new PassPipe();
    const c = new PassPipe();
    graph.addPipe(a);
    graph.addPipe(b);
    graph.addPipe(c);

    const first = graph.connect(a.id, 'output', c.id, 'input');
    graph.connect(b.id, 'output', c.id, 'input');
    expect(graph.connections).toHaveLength(1);
    expect(graph.connections[0].fromPipeId).toBe(b.id);
    expect(graph.getIncomingConnection(c.id, 'input')?.fromPipeId).toBe(b.id);
    expect(graph.getOutgoingConnections(b.id, 'output')).toHaveLength(1);
    expect(graph.connect(c.id, 'output', c.id, 'input')).toBeNull();

    graph.disconnectById(first.id);
    graph.disconnectById(graph.connections[0].id);
    expect(graph.connections).toEqual([]);
    graph.connect(a.id, 'output', b.id, 'input');
    graph.removePipe(a.id);
    expect(graph.pipes.has(a.id)).toBe(false);
    expect(graph.connections).toEqual([]);
    expect(events).toContain('connection-removed');
    expect(events).toContain('pipe-removed');
  });

  it('rejects cycles and orders upstream and downstream nodes', () => {
    const graph = new PipeGraph();
    const [a, b, c] = [new PassPipe(), new PassPipe(), new PassPipe()];
    for (const pipe of [a, b, c]) graph.addPipe(pipe);
    graph.connect(a.id, 'output', b.id, 'input');
    graph.connect(b.id, 'output', c.id, 'input');
    expect(graph.connect(c.id, 'output', a.id, 'input')).toBeNull();
    expect(graph._topologicalOrder()).toEqual([a.id, b.id, c.id]);
    expect(graph._downstreamFrom(a.id)).toEqual([a.id, b.id, c.id]);
  });

  it('reconnects upstream and downstream pipes after removing a pipe', () => {
    const graph = new PipeGraph();
    const [source, removed, firstTarget, secondTarget] =
      [new PassPipe(), new PassPipe(), new PassPipe(), new PassPipe()];
    for (const pipe of [source, removed, firstTarget, secondTarget]) graph.addPipe(pipe);
    graph.connect(source.id, 'output', removed.id, 'input');
    graph.connect(removed.id, 'output', firstTarget.id, 'input');
    graph.connect(removed.id, 'output', secondTarget.id, 'input');

    const pipeStillPresentDuringReconnect = [];
    graph.addListener((event) => {
      if (event.type === 'connection-added') {
        pipeStillPresentDuringReconnect.push(graph.pipes.has(removed.id));
      }
    });
    graph.removePipe(removed.id);

    expect(graph.connections.map(connection => connection.toJSON())).toEqual([
      {
        fromPipeId: source.id,
        fromOutput: 'output',
        toPipeId: firstTarget.id,
        toInput: 'input',
      },
      {
        fromPipeId: source.id,
        fromOutput: 'output',
        toPipeId: secondTarget.id,
        toInput: 'input',
      },
    ]);
    expect(pipeStillPresentDuringReconnect).toEqual([false, false]);
  });

  it('does not create bypass connections without both an input and an output', () => {
    const graph = new PipeGraph();
    const [source, sourceOnly, sinkOnly, target] =
      [new PassPipe(), new PassPipe(), new PassPipe(), new PassPipe()];
    for (const pipe of [source, sourceOnly, sinkOnly, target]) graph.addPipe(pipe);
    graph.connect(sourceOnly.id, 'output', target.id, 'input');
    graph.connect(source.id, 'output', sinkOnly.id, 'input');
    // Simulate a malformed serialized graph; connect() correctly rejects self-loops.
    graph.connections.push(new Connection(sinkOnly.id, 'output', sinkOnly.id, 'input'));

    graph.removePipe(sourceOnly.id);
    graph.removePipe(sinkOnly.id);

    expect(graph.connections).toEqual([]);
  });

  it('processes connected pipes and emits processing events', async () => {
    const graph = new PipeGraph();
    const source = new InputPipe();
    const target = new PassPipe();
    source.setConfig('text', 'flow');
    graph.addPipe(target);
    graph.addPipe(source);
    graph.connect(source.id, 'output', target.id, 'input');
    const listener = vi.fn();
    graph.addListener(listener);
    await graph.processAll();
    expect(decode(target.getOutputData())).toBe('flow');
    expect(listener).toHaveBeenCalledWith({ type: 'processed' });

    source.setConfig('text', 'updated');
    await graph.processFrom(source.id);
    expect(decode(target.getOutputData())).toBe('updated');
    graph.removeListener(listener);
  });

  it('uses a worker pool and synchronizes errors and dynamic outputs', async () => {
    const graph = new PipeGraph();
    const pipe = new UrlParserPipe();
    const run = vi.fn().mockResolvedValue({
      outputs: new Map([['href', encode('https://example.com/')], ['query:x', encode('1')]]),
      errors: [{ message: 'warning', selections: [{ index: 0, length: 1 }] }],
      dynamicOutputPorts: [{ name: 'query:x', description: 'Query parameter: x' }],
    });
    graph.setWorkerPool({ run });
    graph.addPipe(pipe);
    await graph.processAll();
    expect(run).toHaveBeenCalledWith('UrlParser', {}, { input: null });
    expect(pipe.errors[0].message).toBe('warning');
    expect(decode(pipe.getOutputData('query:x'))).toBe('1');
    expect(pipe.defineOutputs().map(({ name }) => name)).toContain('query:x');
  });

  it('records worker failures and clears stale output', async () => {
    const graph = new PipeGraph();
    const pipe = new PassPipe();
    pipe._outputData.set('output', encode('stale'));
    graph.setWorkerPool({ run: vi.fn().mockRejectedValue(new Error('offline')) });
    graph.addPipe(pipe);
    await graph.processAll();
    expect(pipe.getOutputData()).toBeNull();
    expect(pipe.errors[0].message).toBe('offline');
  });

  it('serializes and restores known pipe types while warning on unknown types', () => {
    const graph = new PipeGraph();
    const pipe = new PassPipe();
    pipe.position = { x: 1, y: 2 };
    graph.addPipe(pipe);
    const serialized = graph.toJSON();
    serialized.pipes.push({ id: 'unknown', type: 'Missing' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const restored = new PipeGraph();
    restored.fromJSON(serialized, new Map([['Pass', PassPipe]]));
    expect(restored.pipes.get(pipe.id).position).toEqual({ x: 1, y: 2 });
    expect(warn).toHaveBeenCalledWith('Unknown pipe type: Missing');
  });

  it('selects the newest sink as the last pipe', () => {
    const graph = new PipeGraph();
    const a = new PassPipe();
    const b = new PassPipe();
    a.id = 'pipe-10';
    b.id = 'pipe-20';
    graph.addPipe(a);
    graph.addPipe(b);
    expect(graph.getLastPipe()).toBe(b);
    graph.connect(b.id, 'output', a.id, 'input');
    expect(graph.getLastPipe()).toBe(a);
  });

  it('isolates listener exceptions', () => {
    const graph = new PipeGraph();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    graph.addListener(() => { throw new Error('listener'); });
    graph.addPipe(new PassPipe());
    expect(error).toHaveBeenCalled();
  });
});

describe('registry', () => {
  it('contains every built-in type and creates instances', () => {
    expect([...registry.keys()]).toEqual([
      'InputPipe',
      'FileInputPipe',
      'Base64Encode', 'Base64Decode',
      'PercentEncode', 'PercentDecode',
      'HexEncode', 'HexDecode',
      'HtmlEncode', 'HtmlDecode',
      'XmlEncode', 'XmlDecode',
      'CharsetDecode', 'CharsetEncode',
      'BinaryEncode', 'BinaryDecode',
      'SlashEscape', 'SlashUnescape',
      'UrlEncode', 'UrlDecode',
      'UrlParser', 'JsonParser', 'RegexMatch',
    ]);
    expect(createPipe('HexEncode')).toBeInstanceOf(HexEncodePipe);
    expect(createPipe('missing')).toBeNull();
  });

  it('groups metadata by category in display order', () => {
    const groups = getPipesByCategory();
    expect([...groups.keys()]).toEqual(['Input', 'Encoding', 'Parsing']);
    expect(groups.get('Input')[0].typeName).toBe('InputPipe');
    expect(groups.get('Parsing').at(-1).typeName).toBe('RegexMatch');
  });
});
