import type { Command } from 'commander';
import chalk from 'chalk';

import { requireProjectRoot } from '../core/change.js';
import { buildDashboard, renderDashboard, DashboardData } from '../core/dashboard.js';
import { showChange, readSpec, ChangeSummary } from '../core/inspect.js';

/**
 * `view` command: specs and changes dashboard.
 *
 * Mirrors the `view` command from the reference project (/base) — which is a
 * static panel — and goes further: when there's an interactive terminal (TTY),
 * it opens a number-navigable mode (native readline, no dependencies). `--static`
 * forces the static panel; `--json` returns the raw data.
 */

function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function registerViewCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('view')
    .description('Specs and changes dashboard (interactive in the terminal)')
    .option('--static', 'Prints the static panel and exits (no navigation)')
    .option('--json', 'JSON output of the dashboard data')
    .action(async (options: { static?: boolean; json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const data = await buildDashboard(root);

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        // Static panel: when requested, or when there's no TTY to navigate.
        if (options.static || !canPrompt()) {
          console.log(renderDashboard(data));
          return;
        }

        await runInteractive(root, data);
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}

/** Interactive loop: shows the panel + a numbered menu; navigates to the detail. */
async function runInteractive(root: string, initial: DashboardData): Promise<void> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    let data = initial;
    for (;;) {
      // Unified, numbered list: all changes (by stage) + specs.
      const changes: ChangeSummary[] = [...data.active, ...data.draft, ...data.done];
      const items: Array<{ kind: 'change' | 'spec'; id: string }> = [
        ...changes.map((c) => ({ kind: 'change' as const, id: c.name })),
        ...data.specs.map((s) => ({ kind: 'spec' as const, id: s })),
      ];

      console.clear();
      console.log(renderDashboard(data));
      console.log('');
      if (items.length === 0) {
        console.log(chalk.dim('Nothing to inspect. (q to quit)'));
      } else {
        console.log(chalk.bold('Select an item to see the detail:'));
        items.forEach((it, i) => {
          const tag = it.kind === 'change' ? chalk.cyan('change') : chalk.magenta('spec');
          console.log(`  ${String(i + 1).padStart(2)}) [${tag}] ${it.id}`);
        });
      }

      const answer = (await rl.question('\nNumber to open, "r" to refresh, "q" to quit: ')).trim().toLowerCase();

      if (answer === 'q' || answer === '') {
        if (answer === 'q') break;
        // Enter with no number: just re-render.
        continue;
      }
      if (answer === 'r') {
        data = await buildDashboard(root);
        continue;
      }

      const index = Number.parseInt(answer, 10);
      if (!Number.isInteger(index) || index < 1 || index > items.length) {
        continue; // invalid input: back to the panel
      }

      const item = items[index - 1];
      console.clear();
      if (item.kind === 'change') {
        const d = await showChange(root, item.id);
        console.log(chalk.bold(`${d.name}`) + chalk.dim(` (${d.status})`));
        console.log(`Title: ${d.title}`);
        console.log(`Tasks: ${d.tasks.completed}/${d.tasks.total} completed`);
        console.log('Artifacts:');
        for (const a of d.artifacts) {
          console.log(`  ${a.exists ? chalk.green('✓') : chalk.red('✗')} ${a.file}`);
        }
        if (d.specs.length > 0) console.log(`Change specs: ${d.specs.join(', ')}`);
      } else {
        console.log(chalk.bold(`spec: ${item.id}`));
        console.log('');
        console.log(await readSpec(root, item.id));
      }

      await rl.question(chalk.dim('\n[Enter] to go back to the dashboard...'));
    }
  } finally {
    rl.close();
  }
}
