import { describe, it, expect } from 'vitest';

import { editDistance, nearestMatches } from '../src/core/match.js';

describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('propose', 'propose')).toBe(0);
  });

  it('equals the other length when one string is empty', () => {
    expect(editDistance('', 'apply')).toBe(5);
    expect(editDistance('verify', '')).toBe(6);
  });

  it('counts single-character edits', () => {
    expect(editDistance('verify', 'verfy')).toBe(1); // deletion
    expect(editDistance('verify', 'verifyy')).toBe(1); // insertion
    expect(editDistance('verify', 'xerify')).toBe(1); // substitution
  });

  it('is symmetric', () => {
    expect(editDistance('kitten', 'sitting')).toBe(editDistance('sitting', 'kitten'));
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('nearestMatches', () => {
  const commands = ['propose', 'apply', 'verify', 'merge', 'archive'];

  it('suggests the closest command for a typo', () => {
    expect(nearestMatches('verfy', commands)[0]).toBe('verify');
    expect(nearestMatches('aply', commands)[0]).toBe('apply');
  });

  it('is case-insensitive', () => {
    expect(nearestMatches('VERIFY', commands)[0]).toBe('verify');
  });

  it('returns nothing for input that is too far from any candidate', () => {
    expect(nearestMatches('zzzzzzzz', commands)).toEqual([]);
  });

  it('respects the limit', () => {
    const result = nearestMatches('a', commands, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('orders by proximity then alphabetically', () => {
    const result = nearestMatches('merge', ['merge', 'merged', 'merga']);
    expect(result[0]).toBe('merge');
  });
});
