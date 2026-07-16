import { describe, expect, it } from 'vitest';
import { guessPipeChain } from '../src/guess.js';
import { registry } from '../src/pipes/registry.js';

describe('encoding chain guessing', () => {
  it('prefers the longest valid shortening chain', async () => {
    const input = new TextEncoder().encode('U0dWc2JHOD0=');
    const result = await guessPipeChain(input, registry.values());

    expect(result.map(step => step.typeName)).toEqual([
      'Base64Decode',
      'Base64Decode',
    ]);
  });

  it('returns no pipes when no applicable pipe shortens the input', async () => {
    const input = new TextEncoder().encode('plain text');
    expect(await guessPipeChain(input, registry.values())).toEqual([]);
  });
});
