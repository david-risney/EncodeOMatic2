import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listIdbSessions,
  loadFromIdb,
  loadFromUrl,
  saveToIdb,
  saveToUrl,
} from '../src/state.js';

describe('state persistence', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/app?unrelated=1');
  });

  it('round trips small Unicode graphs through a base64url parameter', async () => {
    const graph = { pipes: [{ configs: { text: 'héllo 🌍' } }], connections: [] };
    const result = await saveToUrl(graph);
    const url = new URL(result);
    expect(url.searchParams.has('g')).toBe(true);
    expect(url.searchParams.has('gid')).toBe(false);
    expect(url.searchParams.get('unrelated')).toBe('1');
    expect(await loadFromUrl()).toEqual(graph);
  });

  it('keeps large graphs in the shareable URL', async () => {
    const graph = { text: 'x'.repeat(3000) };
    await saveToUrl(graph);
    expect(new URL(window.location.href).searchParams.has('g')).toBe(true);
    expect(new URL(window.location.href).searchParams.has('gid')).toBe(false);
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
});
