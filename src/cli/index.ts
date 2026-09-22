import { Command } from 'commander';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import { registerInitCommand } from '../commands/init.js';
import { registerWorkflowCommands } from '../commands/workflow.js';
import { registerInspectCommands } from '../commands/inspect.js';
import { registerConfigCommand } from '../commands/config.js';
import { registerCompletionCommand } from '../commands/completion.js';
import { registerViewCommand } from '../commands/view.js';
import { registerMcpCommand } from '../commands/mcp.js';
import { renderVersion } from '../ui/version.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

/**
 * Reports an error consistently and sets the exit code.
 * Mirrors the `failWithError` pattern from the reference project (/base),
 * but lean: no telemetry and no per-command JSON payloads.
 */
export function failWithError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`Error: ${message}`));
  process.exitCode = process.exitCode ?? 1;
}

const program = new Command();

program
  .name('agentic-fy')
  .description('A lean, performant spec-driven CLI with MCP support')
  // Version flag as a common option: the custom output (logo + version +
  // commands) is handled in `printVersion`, not by commander's built-in handler.
  .option('-v, --version', 'Show the version, the logo, and the available commands')
  .option('--no-color', 'Disable colored output');

program.hook('preAction', (thisCommand) => {
  if (thisCommand.opts().color === false) {
    process.env.NO_COLOR = '1';
  }
});

// Command registration (setup + workflow + inspection + mcp)
registerInitCommand(program, failWithError);
registerWorkflowCommands(program, failWithError);
registerInspectCommands(program, failWithError);
registerConfigCommand(program, failWithError);
registerCompletionCommand(program, failWithError);
registerViewCommand(program, failWithError);
registerMcpCommand(program, failWithError);

export { program };

/** Prints logo + version + all available commands. */
export function printVersion(): void {
  if (program.opts().color === false) {
    process.env.NO_COLOR = '1';
  }
  console.log(renderVersion(program, version));
}

export function runCli(argv = process.argv): void {
  // Intercept -v/--version before parsing subcommands to show the custom
  // screen (commander would only print the version string).
  const args = argv.slice(2);
  if (args.includes('-v') || args.includes('--version')) {
    printVersion();
    return;
  }

  program.parseAsync(argv).catch((error) => {
    failWithError(error);
    process.exit(process.exitCode ?? 1);
  });
}

// Allows `node dist/cli/index.js` directly during development.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
