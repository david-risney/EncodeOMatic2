import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listIdbSessions,
  loadFromIdb,
  loadFromUrl,
  saveToIdb,
  saveToUrl,
  saveAutosession,
  loadAutosession,
  listDefaultSessions,
  loadDefaultSession,
} from '../src/state.js';
import { PipeGraph } from '../src/pipes/graph.js';
import { registry } from '../src/pipes/registry.js';

describe('state persistence', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/app?unrelated=1');
  });

  it('round trips small Unicode graphs through a base64url parameter', async () => {
    const graph = { pipes: [{ configs: { text: 'héllo 🌍' } }], connections: [] };
    const result = await saveToUrl(graph);
    const url = new URL(result);
    expect(url.searchParams.has('g') || url.searchParams.has('gc')).toBe(true);
    expect(url.searchParams.has('gid')).toBe(false);
    expect(url.searchParams.get('unrelated')).toBe('1');
    expect(await loadFromUrl()).toEqual(graph);
  });

  it('keeps large graphs in the shareable URL and round trips', async () => {
    const graph = { text: 'x'.repeat(3000) };
    const result = await saveToUrl(graph);
    const url = new URL(result);
    expect(url.searchParams.has('g') || url.searchParams.has('gc')).toBe(true);
    expect(url.searchParams.has('gid')).toBe(false);
    expect(await loadFromUrl()).toEqual(graph);
  });

  it('uses compressed format for repetitive large graphs when compression is available', async () => {
    if (typeof CompressionStream !== 'function') return;
    const graph = { text: 'x'.repeat(3000) };
    const result = await saveToUrl(graph);
    const url = new URL(result);
    expect(url.searchParams.has('gc')).toBe(true);
    expect(url.searchParams.has('g')).toBe(false);
  });

  it('loads a graph from an uncompressed ?g= URL param', async () => {
    const graph = { pipes: [], connections: [] };
    // Manually set uncompressed param
    const json = JSON.stringify(graph);
    const encoded = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    window.history.replaceState({}, '', `/?g=${encoded}`);
    expect(await loadFromUrl()).toEqual(graph);
  });

  it('loads a graph from a compressed ?gc= URL param', async () => {
    if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function') return;
    const graph = { pipes: [], connections: [], tag: 'compressed' };
    // Save so the compressed param gets set
    await saveToUrl(graph);
    const url = new URL(window.location.href);
    // Force use of gc= by saving a large repetitive graph, then load
    const largeGraph = { text: 'abc'.repeat(500) };
    await saveToUrl(largeGraph);
    const params = new URLSearchParams(window.location.search);
    expect(params.has('gc')).toBe(true);
    expect(await loadFromUrl()).toEqual(largeGraph);
  });

  it('prefers compressed over uncompressed when both params are present', async () => {
    if (typeof DecompressionStream !== 'function') return;
    const graph = { from: 'compressed' };
    // Build a compressed gc= value manually
    const json = JSON.stringify(graph);
    const bytes = new TextEncoder().encode(json);
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    const chunks = [];
    const reader = stream.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const compressed = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { compressed.set(c, off); off += c.length; }
    let binary = '';
    for (const b of compressed) binary += String.fromCharCode(b);
    const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const unrelated = btoa(JSON.stringify({ from: 'uncompressed' })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    window.history.replaceState({}, '', `/?gc=${b64}&g=${unrelated}`);
    expect(await loadFromUrl()).toEqual(graph);
  });

  it('saves and loads named IndexedDB entries', async () => {
    await saveToIdb('named', { value: 42 });
    expect(await loadFromIdb('named')).toEqual({ value: 42 });
    expect(await loadFromIdb('missing')).toBeNull();
    expect(await listIdbSessions()).toContainEqual({
      name: 'named',
      savedAt: expect.any(Number),
    });
  });

  it('returns null with no or malformed state parameters', async () => {
    expect(await loadFromUrl()).toBeNull();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.replaceState({}, '', '/?g=%%%');
    expect(await loadFromUrl()).toBeNull();
    expect(error).toHaveBeenCalledWith(
      'Failed to decode graph from URL:', expect.anything()
    );
  });

  it('returns null and logs error for a malformed ?gc= param', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.replaceState({}, '', '/?gc=!!!invalid!!!');
    expect(await loadFromUrl()).toBeNull();
    expect(error).toHaveBeenCalledWith(
      'Failed to decode graph from URL:', expect.anything()
    );
  });

  it('loadAutosession returns null when nothing has been saved', async () => {
    expect(await loadAutosession()).toBeNull();
  });

  it('saves and loads the autosave session', async () => {
    const graph = { pipes: [{ id: 'auto1' }], connections: [] };
    await saveAutosession(graph);
    expect(await loadAutosession()).toEqual(graph);
  });

  it('listIdbSessions excludes the autosave entry', async () => {
    await saveAutosession({ pipes: [], connections: [] });
    await saveToIdb('visible-session', { pipes: [], connections: [] });
    const sessions = await listIdbSessions();
    const names = sessions.map(s => s.name);
    expect(names).toContain('visible-session');
    expect(names.some(n => n.startsWith('__'))).toBe(false);
  });

  it('lists built-in example sessions', () => {
    expect(listDefaultSessions()).toEqual([
      { name: 'Example: SAML Redirect Decode' },
      { name: 'Example: EncodeOMatic2 qc URL Decode' },
      { name: 'Example: AES-GCM Decryption' },
      { name: 'Example: ABNF HTTP Request Line' },
      { name: 'Example: ASN.1 DER Inspection' },
      { name: 'Example: Fix Mojibake' },
    ]);
  });

  it('loads a built-in example session as graph JSON', () => {
    const example = loadDefaultSession('Example: EncodeOMatic2 qc URL Decode');
    expect(example.pipes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'InputPipe',
        configs: expect.objectContaining({
          text: expect.stringContaining('?qc='),
        }),
      }),
      expect.objectContaining({ type: 'UrlParser' }),
      expect.objectContaining({ type: 'Base64urlDecode' }),
      expect.objectContaining({ type: 'DeflateRawDecompress' }),
      expect.objectContaining({ type: 'JsonParser' }),
    ]));
    expect(example.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromPipeId: 'pipe-5', toPipeId: 'pipe-6' }),
      expect.objectContaining({ fromPipeId: 'pipe-6', fromOutput: 'query:qc', toPipeId: 'pipe-7' }),
      expect.objectContaining({ fromPipeId: 'pipe-7', toPipeId: 'pipe-8' }),
      expect.objectContaining({ fromPipeId: 'pipe-8', toPipeId: 'pipe-9' }),
    ]));
    expect(loadDefaultSession('missing-example')).toBeNull();
  });

  it('adds XML parsing to the SAML redirect example', () => {
    const example = loadDefaultSession('Example: SAML Redirect Decode');
    expect(example.pipes).toContainEqual(expect.objectContaining({ type: 'XmlParser' }));
    expect(example.connections).toContainEqual(expect.objectContaining({
      fromPipeId: 'pipe-4', fromOutput: 'output', toPipeId: 'pipe-10', toInput: 'input',
    }));
  });

  it.each([
    ['Example: AES-GCM Decryption', 'parse-plaintext', 'json', '{\n  "message": "Decryption successful"\n}'],
    ['Example: ABNF HTTP Request Line', 'parse-request-line', 'valid', 'true'],
    ['Example: ASN.1 DER Inspection', 'inspect-asn1-json', 'path:idBlock.tagNumber', '16'],
    ['Example: Fix Mojibake', 'decode-original-text', 'output', 'It’s a café.'],
  ])('processes %s without errors', async (name, outputPipeId, outputName, expected) => {
    const graph = new PipeGraph();
    graph.fromJSON(loadDefaultSession(name), registry);

    await graph.processAll();

    expect([...graph.pipes.values()].flatMap(pipe => pipe.errors)).toEqual([]);
    expect(new TextDecoder().decode(graph.pipes.get(outputPipeId).getOutputData(outputName)))
      .toBe(expected);
  });

  it('returns independent copies of built-in sessions', () => {
    const first = loadDefaultSession('Example: Fix Mojibake');
    first.pipes[0].configs.text = 'changed';

    expect(loadDefaultSession('Example: Fix Mojibake').pipes[0].configs.text)
      .toBe('Itâ€™s a cafÃ©.');
  });
});
