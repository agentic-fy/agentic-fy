import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import chalk from 'chalk';

/**
 * `ticket` command: opens the project's "new issue" page on GitHub so users can
 * report a bug or request a feature without hunting for the URL.
 *
 * Opening the browser uses the OS's native handler (no dependency). If it can't
 * open — headless, SSH, CI, or no browser — it prints the URL instead, so the
 * command is always useful. `--print` forces the print-only behavior.
 */

const ISSUE_URL = 'https://github.com/agentic-fy/agentic-fy/issues/new';

/** Returns the OS command + args that open a URL in the default browser. */
function openCommand(url: string): { command: string; args: string[] } {
  switch (process.platform) {
    case 'win32':
      // `start` is a cmd builtin; the empty "" is the (ignored) window title,
      // which avoids a URL with spaces being treated as the title.
      return { command: 'cmd', args: ['/c', 'start', '', url] };
    case 'darwin':
      return { command: 'open', args: [url] };
    default:
      return { command: 'xdg-open', args: [url] };
  }
}

export function registerTicketCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('ticket')
    .description('Opens the agentic-fy "new issue" page on GitHub (bug report / feature request)')
    .option('--print', 'Only print the URL instead of opening the browser')
    .action(async (options: { print?: boolean }) => {
      try {
        if (options.print) {
          console.log(ISSUE_URL);
          return;
        }

        const { command, args } = openCommand(ISSUE_URL);
        const child = spawn(command, args, { stdio: 'ignore', detached: true });

        // If the opener can't be spawned (e.g. xdg-open missing), fall back to
        // printing the URL so the user can open it manually.
        child.on('error', () => {
          console.log(chalk.dim("Couldn't open the browser. Open this URL:"));
          console.log(ISSUE_URL);
        });
        child.on('spawn', () => {
          console.log(`Opening ${ISSUE_URL}`);
          child.unref();
        });
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
