import { describe, it, expect } from 'vitest';

import { parseSpecDelta } from '../src/core/spec-delta.js';

describe('parseSpecDelta', () => {
  it('parses a valid add delta', () => {
    const yaml = [
      'capability: dark-mode',
      'operations:',
      '  - op: add',
      '    id: toggle',
      '    title: Toggle',
      '    statement: The system SHALL toggle the theme.',
      '    verify: npm test -- toggle',
      '    scenarios:',
      '      - when: the user clicks the toggle',
      '        then: the theme switches',
    ].join('\n');

    const delta = parseSpecDelta(yaml);
    expect(delta.capability).toBe('dark-mode');
    expect(delta.operations).toHaveLength(1);
    const op = delta.operations[0];
    expect(op.op).toBe('add');
    if (op.op === 'add') {
      expect(op.id).toBe('toggle');
      expect(op.verify).toBe('npm test -- toggle');
      expect(op.scenarios).toHaveLength(1);
    }
  });

  it('throws on malformed YAML', () => {
    expect(() => parseSpecDelta(': : : not yaml', 'x.delta.yaml')).toThrow(/Invalid YAML in x\.delta\.yaml/);
  });

  it('rejects a non-kebab-case id', () => {
    const yaml = [
      'capability: dark-mode',
      'operations:',
      '  - op: add',
      '    id: NotKebab',
      '    title: X',
      '    statement: Y',
    ].join('\n');
    expect(() => parseSpecDelta(yaml)).toThrow(/kebab-case/);
  });

  it('rejects a delta with no operations', () => {
    expect(() => parseSpecDelta('capability: x\noperations: []')).toThrow(/at least one operation/);
  });

  it('rejects a modify that changes nothing', () => {
    const yaml = [
      'capability: dark-mode',
      'operations:',
      '  - op: modify',
      '    id: toggle',
    ].join('\n');
    expect(() => parseSpecDelta(yaml)).toThrow(/changes nothing/);
  });

  it('accepts a modify that sets a field', () => {
    const yaml = [
      'capability: dark-mode',
      'operations:',
      '  - op: modify',
      '    id: toggle',
      '    set:',
      '      statement: The system SHALL do better.',
    ].join('\n');
    const delta = parseSpecDelta(yaml);
    expect(delta.operations[0].op).toBe('modify');
  });
});
