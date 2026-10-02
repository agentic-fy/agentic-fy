import { describe, it, expect } from 'vitest';

import { parseTasks } from '../src/core/artifacts.js';

describe('parseTasks', () => {
  it('parses unchecked and checked checkboxes', () => {
    const md = ['- [ ] 1. First task', '- [x] 2. Second task'].join('\n');
    const tasks = parseTasks(md);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ done: false, text: '1. First task' });
    expect(tasks[1]).toMatchObject({ done: true, text: '2. Second task' });
  });

  it('treats uppercase [X] as done', () => {
    expect(parseTasks('- [X] done')[0].done).toBe(true);
  });

  it('accepts both - and * bullets and leading indentation', () => {
    const md = ['  - [ ] indented dash', '* [x] star bullet'].join('\n');
    const tasks = parseTasks(md);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].text).toBe('indented dash');
    expect(tasks[1].done).toBe(true);
  });

  it('ignores lines that are not checkboxes', () => {
    const md = ['# Tasks', 'Some prose', '- a plain bullet', '- [ ] a real task'].join('\n');
    const tasks = parseTasks(md);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('a real task');
  });

  it('handles CRLF line endings', () => {
    const md = '- [ ] one\r\n- [x] two';
    const tasks = parseTasks(md);
    expect(tasks).toHaveLength(2);
    expect(tasks[1].done).toBe(true);
  });

  it('returns an empty array when there are no tasks', () => {
    expect(parseTasks('no checkboxes here')).toEqual([]);
  });
});
