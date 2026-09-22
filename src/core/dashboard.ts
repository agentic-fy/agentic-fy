import chalk from 'chalk';

import { listChangeSummaries, listSpecIds, ChangeSummary } from './inspect.js';

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
  totals: { changes: number; specs: number; tasksTotal: number; tasksDone: number };
}

/** Classifies a change's status into one of the panel's three groups. */
function bucketOf(status: string): 'draft' | 'active' | 'done' {
  if (status === 'applying') return 'active';
  if (status === 'verified') return 'done';
  return 'draft'; // exploring, proposed (and any other) count as draft
}

export async function buildDashboard(root: string): Promise<DashboardData> {
  const [summaries, specs] = await Promise.all([
    listChangeSummaries(root),
    listSpecIds(root),
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
    totals: { changes: summaries.length, specs: specs.length, tasksTotal, tasksDone },
  };
}

/** Block progress bar (fixed width), /base style. */
export function progressBar(completed: number, total: number, width = 20): string {
  if (total === 0) return chalk.dim('─'.repeat(width));
  const filled = Math.round((completed / total) * width);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
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

  // Summary.
  const { totals } = data;
  lines.push(
    `Changes: ${totals.changes}  ·  Specs: ${totals.specs}  ·  ` +
      `Tasks: ${totals.tasksDone}/${totals.tasksTotal} (${pct(totals.tasksDone, totals.tasksTotal)})`
  );

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
