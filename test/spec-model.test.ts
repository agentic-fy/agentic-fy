import { describe, it, expect } from 'vitest';

import {
  CapabilitySpec,
  parseSpec,
  renderSpec,
  slugify,
} from '../src/core/spec-model.js';

const sample: CapabilitySpec = {
  capability: 'dark-mode',
  purpose: 'Let users switch the theme.',
  requirements: [
    {
      id: 'toggle',
      title: 'Toggle',
      statement: 'The system SHALL toggle the theme.',
      verify: 'npm test -- toggle',
      scenarios: [{ when: 'the user clicks the toggle', then: 'the theme switches' }],
    },
    {
      id: 'persist',
      title: 'Persist choice',
      statement: 'The system SHALL remember the choice.',
      scenarios: [],
    },
  ],
};

describe('slugify', () => {
  it('kebab-cases a title', () => {
    expect(slugify('Persist Choice')).toBe('persist-choice');
    expect(slugify('  Weird__Title!! ')).toBe('weird-title');
  });
});

describe('renderSpec / parseSpec round-trip', () => {
  it('renders then parses back to the same model', () => {
    const md = renderSpec(sample);
    const parsed = parseSpec(md, 'dark-mode');
    expect(parsed).toEqual(sample);
  });

  it('is stable: rendering a parsed spec yields identical markdown', () => {
    const md1 = renderSpec(sample);
    const md2 = renderSpec(parseSpec(md1, 'dark-mode'));
    expect(md2).toBe(md1);
  });

  it('derives an id from the title when {#id} is absent', () => {
    const md = [
      '# cap',
      '',
      '## Purpose',
      'TBD.',
      '',
      '## Requirements',
      '',
      '### Requirement: Hand Written',
      'The system SHALL work.',
    ].join('\n');
    const parsed = parseSpec(md, 'cap');
    expect(parsed.requirements[0].id).toBe('hand-written');
  });

  it('keeps an unset purpose empty on round-trip (TBD placeholder ignored)', () => {
    const spec: CapabilitySpec = { capability: 'cap', purpose: '', requirements: [] };
    const parsed = parseSpec(renderSpec(spec), 'cap');
    expect(parsed.purpose).toBe('');
  });

  it('parses the verify line into the requirement', () => {
    const parsed = parseSpec(renderSpec(sample), 'dark-mode');
    expect(parsed.requirements[0].verify).toBe('npm test -- toggle');
    expect(parsed.requirements[1].verify).toBeUndefined();
  });
});
