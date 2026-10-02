import { describe, it, expect } from 'vitest';

import { mergeDelta } from '../src/core/spec-merge.js';
import { CapabilitySpec } from '../src/core/spec-model.js';
import { parseSpecDelta } from '../src/core/spec-delta.js';

function delta(yaml: string) {
  return parseSpecDelta(yaml);
}

const addToggle = delta(
  [
    'capability: dark-mode',
    'purpose: Let users switch the theme.',
    'operations:',
    '  - op: add',
    '    id: toggle',
    '    title: Toggle',
    '    statement: The system SHALL toggle the theme.',
    '    verify: npm test -- toggle',
  ].join('\n')
);

describe('mergeDelta — add', () => {
  it('creates a fresh spec from a null base', () => {
    const result = mergeDelta(null, addToggle);
    expect(result.created).toBe(true);
    expect(result.counts.added).toBe(1);
    expect(result.spec.capability).toBe('dark-mode');
    expect(result.spec.purpose).toBe('Let users switch the theme.');
    expect(result.spec.requirements[0].id).toBe('toggle');
  });

  it('is idempotent: re-adding an identical requirement is a no-op', () => {
    const first = mergeDelta(null, addToggle);
    const second = mergeDelta(first.spec, addToggle);
    expect(second.counts.added).toBe(0);
    expect(second.spec.requirements).toHaveLength(1);
  });

  it('throws when adding a conflicting requirement with the same id', () => {
    const base = mergeDelta(null, addToggle).spec;
    const conflicting = delta(
      [
        'capability: dark-mode',
        'operations:',
        '  - op: add',
        '    id: toggle',
        '    title: Different',
        '    statement: The system SHALL do something else.',
      ].join('\n')
    );
    expect(() => mergeDelta(base, conflicting)).toThrow(/already exists/);
  });

  it('never overwrites an existing purpose', () => {
    const base: CapabilitySpec = {
      capability: 'dark-mode',
      purpose: 'Original purpose.',
      requirements: [],
    };
    const withPurpose = delta(
      [
        'capability: dark-mode',
        'purpose: New purpose that should be ignored.',
        'operations:',
        '  - op: add',
        '    id: x',
        '    title: X',
        '    statement: The system SHALL X.',
      ].join('\n')
    );
    const result = mergeDelta(base, withPurpose);
    expect(result.spec.purpose).toBe('Original purpose.');
  });
});

describe('mergeDelta — modify', () => {
  it('patches the statement of an existing requirement', () => {
    const base = mergeDelta(null, addToggle).spec;
    const mod = delta(
      [
        'capability: dark-mode',
        'operations:',
        '  - op: modify',
        '    id: toggle',
        '    set:',
        '      statement: The system SHALL toggle instantly.',
      ].join('\n')
    );
    const result = mergeDelta(base, mod);
    expect(result.counts.modified).toBe(1);
    expect(result.spec.requirements[0].statement).toBe('The system SHALL toggle instantly.');
  });

  it('throws when modifying a missing id', () => {
    const base = mergeDelta(null, addToggle).spec;
    const mod = delta(
      [
        'capability: dark-mode',
        'operations:',
        '  - op: modify',
        '    id: nonexistent',
        '    set:',
        '      title: Nope',
      ].join('\n')
    );
    expect(() => mergeDelta(base, mod)).toThrow(/not found/);
  });

  it('adds scenarios without duplicating existing ones', () => {
    const base = mergeDelta(null, addToggle).spec;
    const mod = delta(
      [
        'capability: dark-mode',
        'operations:',
        '  - op: modify',
        '    id: toggle',
        '    addScenarios:',
        '      - when: the user clicks',
        '        then: it toggles',
      ].join('\n')
    );
    const once = mergeDelta(base, mod);
    const twice = mergeDelta(once.spec, mod);
    expect(once.spec.requirements[0].scenarios).toHaveLength(1);
    expect(twice.spec.requirements[0].scenarios).toHaveLength(1);
  });
});

describe('mergeDelta — remove', () => {
  it('removes an existing requirement', () => {
    const base = mergeDelta(null, addToggle).spec;
    const rem = delta(
      [
        'capability: dark-mode',
        'operations:',
        '  - op: remove',
        '    id: toggle',
      ].join('\n')
    );
    const result = mergeDelta(base, rem);
    expect(result.counts.removed).toBe(1);
    expect(result.spec.requirements).toHaveLength(0);
  });

  it('warns but does not throw when removing a missing id', () => {
    const base = mergeDelta(null, addToggle).spec;
    const rem = delta(
      [
        'capability: dark-mode',
        'operations:',
        '  - op: remove',
        '    id: ghost',
      ].join('\n')
    );
    const result = mergeDelta(base, rem);
    expect(result.counts.removed).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/ghost/);
  });
});

describe('mergeDelta — ordering', () => {
  it('does not mutate the base spec', () => {
    const base = mergeDelta(null, addToggle).spec;
    const snapshot = JSON.stringify(base);
    const rem = delta(
      ['capability: dark-mode', 'operations:', '  - op: remove', '    id: toggle'].join('\n')
    );
    mergeDelta(base, rem);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
