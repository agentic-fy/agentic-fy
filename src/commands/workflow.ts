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
 * Registers the 5 workflow commands. Each handler simply delegates to the
 * corresponding pure function in core/workflow.ts and formats the output.
 */
export function registerWorkflowCommands(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('explore')
    .description('Maps the problem and understands the codebase (thinking mode)')
    .action(async () => {
      try {
        printResult(await runExplore());
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
        printResult(await runPropose(name));
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
        printResult(await runApply(name));
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
        printResult(await runVerify(name, process.cwd(), { allowGaps: options.allowGaps }));
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
        printResult(await runMerge(name, process.cwd(), { dryRun: options.dryRun }));
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
        printResult(await runArchive(name, process.cwd(), { dryRun: options.dryRun }));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
