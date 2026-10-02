import type { Command } from 'commander';
import chalk from 'chalk';

import {
  runExplore,
  runPropose,
  runApply,
  runVerify,
  runMerge,
  runArchive,
  type WorkflowResult,
} from '../core/workflow.js';
import { startStep } from '../ui/spinner.js';

function printResult(result: WorkflowResult): void {
  if (result.change) {
    console.log(chalk.bold(`[${result.action}] ${result.change}`));
  } else {
    console.log(chalk.bold(`[${result.action}]`));
  }
  for (const line of result.messages) {
    console.log(line);
  }
}

/**
 * Runs a workflow action behind a spinner, then prints the detailed result.
 *
 * `label` is the in-progress text; `done` builds the ✓ summary from the result.
 * `delay` defers the spinner so instant commands stay clean and the spinner
 * only appears when the work actually waits (default 150ms; pass 0 for steps
 * that always wait, like verify running evidence commands).
 */
async function withSpinner(
  label: string,
  work: () => Promise<WorkflowResult>,
  done: (result: WorkflowResult) => string,
  delay = 150
): Promise<void> {
  const spinner = startStep(label, { delay });
  try {
    const result = await work();
    spinner.succeed(done(result));
    printResult(result);
  } catch (error) {
    spinner.fail(label.replace(/\.\.\.$/, '') + ' failed');
    throw error;
  }
}

/**
 * Registers the 5 workflow commands. Each handler simply delegates to the
 * corresponding pure function in core/workflow.ts and formats the output.
 */
export function registerWorkflowCommands(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('explore [name]')
    .description('Maps the problem and the codebase; with a name, starts a change as "exploring"')
    .action(async (name?: string) => {
      try {
        await withSpinner(
          'Exploring...',
          () => runExplore(name),
          (r) => (r.change ? `Exploring ${r.change} (${r.status})` : 'Explored')
        );
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('propose <name>')
    .description('Creates the change and drafts proposal.md, specs/, design.md, tasks.md')
    .action(async (name: string) => {
      try {
        await withSpinner(
          'Proposing...',
          () => runPropose(name),
          (r) => `Proposed ${r.change}`
        );
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('apply [name]')
    .description('Implements the tasks in tasks.md')
    .action(async (name?: string) => {
      try {
        await withSpinner(
          'Applying...',
          () => runApply(name),
          (r) => `Applying ${r.change}`
        );
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('verify [name]')
    .description('Verifies the implementation against the spec, running each requirement\'s evidence command')
    .option('--allow-gaps', 'Accept requirements that declare no verify command (gaps)')
    .action(async (name: string | undefined, options: { allowGaps?: boolean }) => {
      try {
        // delay 0: verify runs evidence commands, so it genuinely waits.
        await withSpinner(
          'Verifying (running evidence)...',
          () => runVerify(name, process.cwd(), { allowGaps: options.allowGaps }),
          (r) => `Verify ${r.change}: ${r.status}`,
          0
        );
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('merge [name]')
    .description('Applies the change spec deltas to the project specs, keeping the change active (early-sync)')
    .option('--dry-run', 'Preview the spec merge without writing')
    .action(async (name: string | undefined, options: { dryRun?: boolean }) => {
      try {
        await withSpinner(
          options.dryRun ? 'Merging (dry run)...' : 'Merging...',
          () => runMerge(name, process.cwd(), { dryRun: options.dryRun }),
          (r) => `Merged ${r.change}`
        );
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('archive [name]')
    .description('Applies the change spec deltas to the project specs, then archives the change')
    .option('--dry-run', 'Preview the spec merge without writing or archiving')
    .action(async (name: string | undefined, options: { dryRun?: boolean }) => {
      try {
        await withSpinner(
          options.dryRun ? 'Archiving (dry run)...' : 'Archiving...',
          () => runArchive(name, process.cwd(), { dryRun: options.dryRun }),
          (r) => `Archived ${r.change}`
        );
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
