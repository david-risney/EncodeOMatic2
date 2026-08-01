import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION, DEFAULT_SESSION_NAME } from '../src/default-session.js';
import { PipeGraph } from '../src/pipes/graph.js';
import { registry } from '../src/pipes/registry.js';

describe('default session', () => {
  it('inspects a Base64-encoded X.509 certificate with the ASN.1 parser', async () => {
    const graph = new PipeGraph();
    graph.fromJSON(DEFAULT_SESSION, registry);
    await graph.processAll();

    expect(DEFAULT_SESSION_NAME).toBe('x509-certificate-inspection');
    expect([...graph.pipes.values()].map(pipe => pipe.typeName)).toEqual([
      'InputPipe',
      'Base64Decode',
      'Asn1Parser',
    ]);
    expect(graph.connections.map(connection => connection.toJSON())).toEqual(
      DEFAULT_SESSION.connections
    );

    const parsed = JSON.parse(
      new TextDecoder().decode(graph.pipes.get('parse-certificate').getOutputData('json'))
    );
    expect(parsed.idBlock.tagNumber).toBe(16);
    expect(graph.pipes.get('parse-certificate').errors).toEqual([]);
  });
});
