import { promises as fs, existsSync } from 'fs';
import chalk from 'chalk';

import { listChangeSummaries, listSpecIds, ChangeSummary } from './inspect.js';
import { resolveProjectPaths } from './change.js';
import { evidenceCoverage } from './evidence.js';

/**
 * Dashboard data and rendering (`view`).
 *
 * Mirrors the `view` command from the reference project (/base) — a panel of
 * specs and changes with progress bars, grouped by stage — rewritten lean and
 * with no dependencies beyond the chalk the project already uses. Pure
 * functions: they build the data and return a string; the command layer prints it.
 */

export interface DashboardData {
  /** Changes still in draft (exploring/proposed). */
  draft: ChangeSummary[];
  /** Changes in progress (applying). */
  active: ChangeSummary[];
  /** Ready changes (verified). */
  done: ChangeSummary[];
  specs: string[];
  totals: {
    changes: number;
    /** Archived changes = spec merges applied over the project's lifetime. */
    merged: number;
    specs: number;
    tasksTotal: number;
    tasksDone: number;
    /** Requirements (across active changes) that declare an evidence command. */
    evidenceTotal: number;
    evidenceCovered: number;
  };
}

/** Counts the archived changes (each archive applied a spec merge). */
async function countMerged(root: string): Promise<number> {
  const { archiveDir } = resolveProjectPaths(root);
  if (!existsSync(archiveDir)) return 0;
  const entries = await fs.readdir(archiveDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).length;
}

/** Classifies a change's status into one of the panel's three groups. */
function bucketOf(status: string): 'draft' | 'active' | 'done' {
  if (status === 'applying') return 'active';
  if (status === 'verified') return 'done';
  return 'draft'; // exploring, proposed (and any other) count as draft
}

export async function buildDashboard(root: string): Promise<DashboardData> {
  const [summaries, specs, merged, evidence] = await Promise.all([
    listChangeSummaries(root),
    listSpecIds(root),
    countMerged(root),
    evidenceCoverage(root),
  ]);

  const draft: ChangeSummary[] = [];
  const active: ChangeSummary[] = [];
  const done: ChangeSummary[] = [];
  let tasksTotal = 0;
  let tasksDone = 0;

  for (const c of summaries) {
    tasksTotal += c.tasks.total;
    tasksDone += c.tasks.completed;
    const bucket = bucketOf(c.status);
    (bucket === 'active' ? active : bucket === 'done' ? done : draft).push(c);
  }

  return {
    draft,
    active,
    done,
    specs,
    totals: {
      changes: summaries.length,
      merged,
      specs: specs.length,
      tasksTotal,
      tasksDone,
      evidenceTotal: evidence.total,
      evidenceCovered: evidence.passed,
    },
  };
}

/** Block progress bar (fixed width), /base style. */
export function progressBar(completed: number, total: number, width = 20): string {
  if (total === 0) return chalk.dim('─'.repeat(width));
  const filled = Math.round((completed / total) * width);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
}

/** Bracketed progress bar, e.g. `[███░░░░░]`. Empty stays `[░░░...]`. */
export function bracketBar(completed: number, total: number, width = 20): string {
  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(ratio * width);
  const inner = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
  return `${chalk.dim('[')}${inner}${chalk.dim(']')}`;
}

function pct(completed: number, total: number): string {
  const p = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `${p}%`;
}

/** Renders the static dashboard as a string. */
export function renderDashboard(data: DashboardData): string {
  const lines: string[] = [];
  const rule = '═'.repeat(60);
  const sub = '─'.repeat(60);

  lines.push('');
  lines.push(chalk.bold('agentic-fy Dashboard'));
  lines.push(rule);
  lines.push('');

  // Summary: one metric per line, labels aligned, with a bracketed task bar.
  const { totals } = data;
  const label = (text: string) => `${text}:`.padEnd(10);
  lines.push(`${chalk.dim(label('Changes'))}${totals.changes}`);
  lines.push(`${chalk.dim(label('Merged'))}${totals.merged}`);
  lines.push(`${chalk.dim(label('Specs'))}${totals.specs}`);

  const tasks = `${totals.tasksDone}/${totals.tasksTotal}`;
  const taskBar = bracketBar(totals.tasksDone, totals.tasksTotal);
  lines.push(`${chalk.dim(label('Tasks'))}${tasks}  ${taskBar} ${chalk.dim(pct(totals.tasksDone, totals.tasksTotal))}`);

  const ev = `${totals.evidenceCovered}/${totals.evidenceTotal}`;
  const evBar = bracketBar(totals.evidenceCovered, totals.evidenceTotal);
  lines.push(`${chalk.dim(label('Evidence'))}${ev}  ${evBar} ${chalk.dim(pct(totals.evidenceCovered, totals.evidenceTotal))}`);

  if (data.draft.length > 0) {
    lines.push('');
    lines.push(chalk.bold.gray('Drafts'));
    lines.push(sub);
    for (const c of data.draft) {
      lines.push(`  ${chalk.gray('○')} ${c.name} ${chalk.dim(`— ${c.title}`)}`);
    }
  }

  if (data.active.length > 0) {
    lines.push('');
    lines.push(chalk.bold.cyan('In progress'));
    lines.push(sub);
    for (const c of data.active) {
      const bar = progressBar(c.tasks.completed, c.tasks.total);
      lines.push(
        `  ${chalk.yellow('◉')} ${c.name.padEnd(28)} ${bar} ${chalk.dim(pct(c.tasks.completed, c.tasks.total))}`
      );
    }
  }

  if (data.done.length > 0) {
    lines.push('');
    lines.push(chalk.bold.green('Ready (verified)'));
    lines.push(sub);
    for (const c of data.done) {
      lines.push(`  ${chalk.green('✓')} ${c.name} ${chalk.dim(`— ${c.title}`)}`);
    }
  }

  if (data.specs.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Specs'));
    lines.push(sub);
    for (const s of data.specs) lines.push(`  • ${s}`);
  }

  if (data.totals.changes === 0 && data.specs.length === 0) {
    lines.push('');
    lines.push(chalk.dim('Empty project. Run "agentic-fy propose <name>" to get started.'));
  }

  lines.push('');
  lines.push(rule);
  return lines.join('\n');
}
