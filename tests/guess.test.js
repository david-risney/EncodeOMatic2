import { describe, expect, it } from 'vitest';
import { guessPipeChain } from '../src/guess.js';
import { registry } from '../src/pipes/registry.js';
import { GzipCompressPipe } from '../src/pipes/builtin/encoding/compression.js';
import { Base64EncodePipe } from '../src/pipes/builtin/encoding/base64.js';
import { TarCreatePipe } from '../src/pipes/builtin/encoding/tar.js';
import { ZipPipe } from '../src/pipes/builtin/encoding/zip.js';
import { Lz4CompressPipe } from '../src/pipes/builtin/encoding/lz4.js';

async function processBytes(pipe, bytes) {
  const input = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const outputs = await pipe.process(new Map([[pipe.defaultInputName, input]]));
  return outputs.get(pipe.defaultOutputName);
}

describe('encoding chain guessing', () => {
  it('prefers the longest valid shortening chain', async () => {
    const input = new TextEncoder().encode('U0dWc2JHOD0=');
    const result = await guessPipeChain(input, registry.values());

    expect(result.map(step => step.typeName)).toEqual([
      'Base64Decode',
      'Base64Decode',
    ]);
  });

  it('returns no pipes when no applicable pipe transforms the input', async () => {
    const input = new TextEncoder().encode('plain text');
    expect(await guessPipeChain(input, registry.values())).toEqual([]);
  });

  it('detects gzip-compressed input and includes GzipDecompress', async () => {
    // Use highly-repetitive content so gzip output is smaller than input,
    // making the gzip bytes shorter and thus detectable as gzip.
    const plain = new TextEncoder().encode('A'.repeat(200));
    const compressed = await processBytes(new GzipCompressPipe(), plain);
    // Verify the test data actually starts with the gzip magic bytes.
    expect(compressed[0]).toBe(0x1f);
    expect(compressed[1]).toBe(0x8b);

    const result = await guessPipeChain(compressed, registry.values());
    expect(result.map(s => s.typeName)).toContain('GzipDecompress');
  });

  it('detects valid JSON and includes JsonParser', async () => {
    const input = new TextEncoder().encode('{"hello":"world","n":42}');
    const result = await guessPipeChain(input, registry.values());
    expect(result.map(s => s.typeName)).toContain('JsonParser');
  });

  it('detects a tar archive and includes TarExtract', async () => {
    // Pack enough content so the payload is smaller than the tar wrapper.
    const content = new TextEncoder().encode('x'.repeat(600));
    const tarBytes = await processBytes(new TarCreatePipe(), content);
    const result = await guessPipeChain(tarBytes, registry.values());
    expect(result.map(s => s.typeName)).toContain('TarExtract');
  });

  it('detects a zip archive and includes Unzip', async () => {
    const content = new TextEncoder().encode('x'.repeat(600));
    const zipBytes = await processBytes(new ZipPipe(), content);
    const result = await guessPipeChain(zipBytes, registry.values());
    expect(result.map(s => s.typeName)).toContain('Unzip');
  });

  it('detects LZ4-compressed input and includes Lz4Decompress', async () => {
    const plain = new TextEncoder().encode('A'.repeat(200));
    const compressed = await processBytes(new Lz4CompressPipe(), plain);
    expect(compressed[0]).toBe(0x04);
    expect(compressed[1]).toBe(0x22);

    const result = await guessPipeChain(compressed, registry.values());
    expect(result.map(s => s.typeName)).toContain('Lz4Decompress');
  });

  it('chains GzipDecompress followed by Base64Decode', async () => {
    // Build: gzip( base64( repeated text ) )
    // The repeated text base64-encodes to a longer string; gzip of that string
    // produces bytes shorter than the base64 string yet bearing gzip magic.
    const plain = new TextEncoder().encode('A'.repeat(300));
    const b64 = await processBytes(new Base64EncodePipe(), plain);
    const compressed = await processBytes(new GzipCompressPipe(), b64);

    const result = await guessPipeChain(compressed, registry.values());
    const names = result.map(s => s.typeName);
    expect(names).toContain('GzipDecompress');
    expect(names).toContain('Base64Decode');
    // GzipDecompress must come before Base64Decode in the chain.
    expect(names.indexOf('GzipDecompress')).toBeLessThan(names.indexOf('Base64Decode'));
  });

  it('guesses Base64urlDecode → DeflateRawDecompress → JsonParser for the given input', async () => {
    // "q1YqyCxILVayio7VUUrOz8tLTS7JzM8DC9QCAA" is base64url-encoded raw-deflate-compressed JSON.
    // The string contains only alphanumeric characters, so it is also valid base64, and the
    // guesser may return either variant — both decode to the same bytes.  The important
    // assertions are that DeflateRawDecompress and JsonParser are chained after the decode step.
    const input = new TextEncoder().encode('q1YqyCxILVayio7VUUrOz8tLTS7JzM8DC9QCAA');
    const result = await guessPipeChain(input, registry.values());
    const names = result.map(s => s.typeName);
    const base64Step = names.findIndex(n => n === 'Base64urlDecode' || n === 'Base64Decode');
    expect(base64Step, 'expected a Base64 or Base64url decode step').toBeGreaterThanOrEqual(0);
    expect(names).toContain('DeflateRawDecompress');
    expect(names).toContain('JsonParser');
    expect(names.indexOf('DeflateRawDecompress')).toBeGreaterThan(base64Step);
    expect(names.indexOf('JsonParser')).toBeGreaterThan(names.indexOf('DeflateRawDecompress'));
  });
});
