import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { initProject } from '../src/core/init.js';
import {
  runExplore,
  runPropose,
  runApply,
  runVerify,
  runMerge,
  runArchive,
} from '../src/core/workflow.js';
import { listChangeSummaries } from '../src/core/inspect.js';
import { projectStatus } from '../src/core/status.js';
import { validateChange } from '../src/core/validate.js';
import { readChange } from '../src/core/change.js';

/**
 * Command-level tests. They exercise what each CLI command actually does by
 * calling the same core functions the handlers delegate to, in a throwaway temp
 * directory. This covers on-disk I/O, status transitions, and the full workflow
 * — without spawning a process or needing a build. The thin commander handlers
 * only format these results.
 */

let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'agentic-fy-cmd-'));
  await initProject(dir, []); // no tools; just the base structure
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Absolute path inside the project under test. */
const p = (...segs: string[]) => path.join(dir, ...segs);
const changePath = (name: string, ...segs: string[]) =>
  p('agentic-fy', 'changes', name, ...segs);

describe('init', () => {
  it('creates the base structure and the config', () => {
    expect(existsSync(p('agentic-fy.config.yaml'))).toBe(true);
    expect(existsSync(p('agentic-fy', 'specs'))).toBe(true);
    expect(existsSync(p('agentic-fy', 'changes', 'archive'))).toBe(true);
  });

  it('is idempotent and does not overwrite the config', async () => {
    const before = readFileSync(p('agentic-fy.config.yaml'), 'utf8');
    await initProject(dir, []);
    expect(readFileSync(p('agentic-fy.config.yaml'), 'utf8')).toBe(before);
  });
});

describe('explore', () => {
  it('without a name does not create a change', async () => {
    const res = await runExplore(undefined, dir);
    expect(res.action).toBe('explore');
    expect(res.change).toBeUndefined();
  });

  it('with a name registers the change as exploring', async () => {
    const res = await runExplore('add-dark-mode', dir);
    expect(res.change).toBe('add-dark-mode');
    expect(res.status).toBe('exploring');
    const change = await readChange(dir, 'add-dark-mode');
    expect(change.metadata.status).toBe('exploring');
  });
});

describe('propose', () => {
  it('creates the artifacts and a spec delta, status proposed', async () => {
    const res = await runPropose('add-login', dir);
    expect(res.status).toBe('proposed');
    expect(existsSync(changePath('add-login', 'proposal.md'))).toBe(true);
    expect(existsSync(changePath('add-login', 'design.md'))).toBe(true);
    expect(existsSync(changePath('add-login', 'tasks.md'))).toBe(true);
    expect(existsSync(changePath('add-login', 'specs', 'add-login.delta.yaml'))).toBe(true);
  });

  it('normalizes the name into a slug', async () => {
    await runPropose('Add Login', dir);
    expect(existsSync(changePath('add-login'))).toBe(true);
  });

  it('transitions a change from exploring to proposed', async () => {
    await runExplore('reuse-me', dir);
    const res = await runPropose('reuse-me', dir);
    expect(res.status).toBe('proposed');
    expect((await readChange(dir, 'reuse-me')).metadata.status).toBe('proposed');
  });
});

describe('apply', () => {
  it('sets the status to applying and lists pending tasks', async () => {
    await runPropose('feat', dir);
    const res = await runApply('feat', dir);
    expect(res.status).toBe('applying');
    expect((await readChange(dir, 'feat')).metadata.status).toBe('applying');
  });

  it('resolves the single active change when the name is omitted', async () => {
    await runPropose('only-one', dir);
    const res = await runApply(undefined, dir);
    expect(res.change).toBe('only-one');
  });

  it('throws when the name is omitted and there are multiple changes', async () => {
    await runPropose('one', dir);
    await runPropose('two', dir);
    await expect(runApply(undefined, dir)).rejects.toThrow(/multiple active changes/i);
  });
});

describe('verify', () => {
  it('reports converging when a task is still pending', async () => {
    await runPropose('wip', dir);
    writeFileSync(changePath('wip', 'tasks.md'), '# Tasks\n\n- [ ] 1. Not done\n', 'utf8');
    const res = await runVerify('wip', dir, { allowGaps: true });
    expect(res.status).toBe('converging');
    expect((await readChange(dir, 'wip')).metadata.status).toBe('converging');
  });

  it('reaches verified with --allow-gaps when a requirement has no evidence command', async () => {
    await runPropose('done', dir);
    writeFileSync(changePath('done', 'tasks.md'), '# Tasks\n\n- [x] 1. Done\n', 'utf8');
    // Replace the template delta (its verify command would fail) with a
    // requirement that declares no command — a genuine, acceptable gap.
    writeFileSync(
      changePath('done', 'specs', 'done.delta.yaml'),
      [
        'capability: feature',
        'operations:',
        '  - op: add',
        '    id: works',
        '    title: Works',
        '    statement: The system SHALL work.',
        '',
      ].join('\n'),
      'utf8'
    );
    const res = await runVerify('done', dir, { allowGaps: true });
    expect(res.status).toBe('verified');
  });

  it('fails to verify (converging) when an evidence command fails', async () => {
    await runPropose('bad-ev', dir);
    writeFileSync(changePath('bad-ev', 'tasks.md'), '# Tasks\n\n- [x] 1. Done\n', 'utf8');
    writeFileSync(
      changePath('bad-ev', 'specs', 'bad-ev.delta.yaml'),
      [
        'capability: feature',
        'operations:',
        '  - op: add',
        '    id: proven',
        '    title: Proven',
        '    statement: The system SHALL be proven.',
        '    verify: node -e "process.exit(1)"',
        '',
      ].join('\n'),
      'utf8'
    );
    const res = await runVerify('bad-ev', dir, { allowGaps: true });
    expect(res.status).toBe('converging');
  });
});

describe('merge', () => {
  it('dry-run does not write the consolidated spec, real merge does', async () => {
    await runPropose('cap-change', dir);
    writeFileSync(
      changePath('cap-change', 'specs', 'cap-change.delta.yaml'),
      [
        'capability: billing',
        'operations:',
        '  - op: add',
        '    id: charge',
        '    title: Charge',
        '    statement: The system SHALL charge the card.',
        '',
      ].join('\n'),
      'utf8'
    );

    await runMerge('cap-change', dir, { dryRun: true });
    expect(existsSync(p('agentic-fy', 'specs', 'billing.md'))).toBe(false);

    await runMerge('cap-change', dir, {});
    expect(existsSync(p('agentic-fy', 'specs', 'billing.md'))).toBe(true);
    // The change stays active (early-sync).
    expect(existsSync(changePath('cap-change'))).toBe(true);
  });
});

describe('archive', () => {
  it('moves the change into the archive and marks it archived', async () => {
    await runPropose('ship-it', dir);
    const res = await runArchive('ship-it', dir, {});
    expect(res.status).toBe('archived');
    expect(existsSync(changePath('ship-it'))).toBe(false);
    expect(existsSync(p('agentic-fy', 'changes', 'archive', 'ship-it'))).toBe(true);
  });

  it('dry-run previews without moving the change', async () => {
    await runPropose('keep', dir);
    await runArchive('keep', dir, { dryRun: true });
    expect(existsSync(changePath('keep'))).toBe(true);
  });
});

describe('inspection: list / status / validate', () => {
  it('listChangeSummaries returns the active changes', async () => {
    await runPropose('feat-a', dir);
    await runPropose('feat-b', dir);
    const summaries = await listChangeSummaries(dir);
    expect(summaries.map((s) => s.name)).toEqual(['feat-a', 'feat-b']);
    expect(summaries[0].status).toBe('proposed');
  });

  it('projectStatus aggregates totals and by-status counts', async () => {
    await runPropose('feat-a', dir);
    const status = await projectStatus(dir);
    expect(status.total).toBe(1);
    expect(status.byStatus.proposed).toBe(1);
  });

  it('validateChange flags tasks.md with bullets but no checkbox as an error', async () => {
    await runPropose('needs-work', dir);
    writeFileSync(changePath('needs-work', 'tasks.md'), '# Tasks\n\n- a bullet, no checkbox\n', 'utf8');
    const report = await validateChange(dir, 'needs-work');
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.level === 'ERROR')).toBe(true);
  });
});
