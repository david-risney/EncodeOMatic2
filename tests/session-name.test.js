import { describe, expect, it, vi } from 'vitest';
import { randomSessionName } from '../src/session-name.js';

describe('session names', () => {
  it('combines memorable words into a hyphenated name', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    expect(randomSessionName()).toBe('amber-acorn');
  });

  it('offers a large variety of names', () => {
    let call = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const pair = Math.floor(call / 2);
      const value = call % 2 === 0 ? (pair % 48) / 48 : Math.floor(pair / 48) / 48;
      call++;
      return value;
    });
    const names = new Set();
    for (let index = 0; index < 200; index++) names.add(randomSessionName());
    expect(names.size).toBe(200);
  });
});
