import type { Command } from 'commander';
import chalk from 'chalk';

import { requireProjectRoot, listChanges } from '../core/change.js';
import {
  listChangeSummaries,
  listSpecIds,
  showChange,
  readChangeArtifact,
  readSpec,
} from '../core/inspect.js';
import { validateChange } from '../core/validate.js';
import { projectStatus } from '../core/status.js';
import { runDoctor } from '../core/doctor.js';
import { projectContext, renderContext } from '../core/context.js';
import { nearestMatches } from '../core/match.js';
import { CHANGE_ARTIFACTS, ChangeArtifact } from '../core/schema.js';

/**
 * Inspection commands: list, show, validate.
 *
 * A lean rewrite of the equivalent features from the reference project
 * (/base). Each handler delegates to the pure core functions and formats the
 * output. They support `--json` where it makes sense, with no interactive prompts.
 */

// ─── helpers ───────────────────────────────────────────────────────────────────

/** Resolves the name of an existing change or throws with a "did you mean" suggestion. */
async function resolveChangeName(root: string, name: string): Promise<string> {
  const changes = await listChanges(root);
  const names = changes.map((c) => c.name);
  if (names.includes(name)) return name;

  const suggestions = nearestMatches(name, names);
  const hint = suggestions.length
    ? ` Did you mean: ${suggestions.join(', ')}?`
    : names.length
      ? ` Active: ${names.join(', ')}.`
      : '';
  throw new Error(`Change "${name}" not found.${hint}`);
}

function levelPrefix(level: 'ERROR' | 'WARNING' | 'INFO'): string {
  return level === 'ERROR' ? '✗' : level === 'WARNING' ? '⚠' : 'ℹ';
}

// ─── register ──────────────────────────────────────────────────────────────────

export function registerInspectCommands(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  // ─── list ────────────────────────────────────────────────────────────────
  program
    .command('list')
    .description('Lists the active changes (and specs with --specs)')
    .option('--specs', 'Lists the project specs instead of the changes')
    .option('--long', 'Shows title and task progress')
    .option('--json', 'JSON output')
    .action(async (options: { specs?: boolean; long?: boolean; json?: boolean }) => {
      try {
        const root = requireProjectRoot();

        if (options.specs) {
          const specs = await listSpecIds(root);
          if (options.json) {
            console.log(JSON.stringify(specs, null, 2));
          } else if (specs.length === 0) {
            console.log('No specs found.');
          } else {
            specs.forEach((id) => console.log(id));
          }
          return;
        }

        const summaries = await listChangeSummaries(root);
        if (options.json) {
          console.log(JSON.stringify(summaries, null, 2));
          return;
        }
        if (summaries.length === 0) {
          console.log('No active changes. Run "agentic-fy propose <name>".');
          return;
        }
        for (const s of summaries) {
          if (!options.long) {
            console.log(s.name);
            continue;
          }
          const tasks = s.tasks.total > 0 ? ` [tasks ${s.tasks.completed}/${s.tasks.total}]` : '';
          console.log(
            `${chalk.bold(s.name)} ${chalk.dim(`(${s.status})`)}: ${s.title}${chalk.dim(tasks)}`
          );
        }
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  // ─── show ────────────────────────────────────────────────────────────────
  program
    .command('show <name>')
    .description('Shows a change (or a specific artifact/spec)')
    .option('--artifact <id>', `Shows an artifact: ${CHANGE_ARTIFACTS.join(' | ')}`)
    .option('--spec <id>', 'Shows the content of a project spec (agentic-fy/specs/<id>.md)')
    .option('--json', 'JSON output (structured summary of the change)')
    .action(
      async (
        name: string,
        options: { artifact?: string; spec?: string; json?: boolean }
      ) => {
        try {
          const root = requireProjectRoot();

          // Show a project spec (independent of any change).
          if (options.spec) {
            console.log(await readSpec(root, options.spec));
            return;
          }

          const changeName = await resolveChangeName(root, name);

          // Show a raw artifact.
          if (options.artifact) {
            const id = options.artifact.toLowerCase();
            if (!CHANGE_ARTIFACTS.includes(id as ChangeArtifact)) {
              throw new Error(
                `Invalid artifact: "${options.artifact}". Use: ${CHANGE_ARTIFACTS.join(', ')}.`
              );
            }
            console.log(await readChangeArtifact(root, changeName, id as ChangeArtifact));
            return;
          }

          const detail = await showChange(root, changeName);
          if (options.json) {
            console.log(JSON.stringify(detail, null, 2));
            return;
          }

          console.log(chalk.bold(`${detail.name}`) + chalk.dim(` (${detail.status})`));
          console.log(`Title: ${detail.title}`);
          console.log(
            `Tasks: ${detail.tasks.completed}/${detail.tasks.total} completed`
          );
          console.log('Artifacts:');
          for (const a of detail.artifacts) {
            const mark = a.exists ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${mark} ${a.file}`);
          }
          if (detail.specs.length > 0) {
            console.log(`Change specs: ${detail.specs.join(', ')}`);
          }
        } catch (error) {
          failWithError(error);
          process.exit(1);
        }
      }
    );

  // ─── validate ──────────────────────────────────────────────────────────────
  program
    .command('validate [name]')
    .description('Validates the artifacts of a change (or of all with --all)')
    .option('--all', 'Validates all active changes')
    .option('--strict', 'Treats warnings (WARNING) as failures')
    .option('--json', 'JSON output')
    .action(
      async (
        name: string | undefined,
        options: { all?: boolean; strict?: boolean; json?: boolean }
      ) => {
        try {
          const root = requireProjectRoot();

          let targets: string[];
          if (options.all) {
            targets = (await listChanges(root)).map((c) => c.name).sort();
          } else if (name) {
            targets = [await resolveChangeName(root, name)];
          } else {
            const active = await listChanges(root);
            if (active.length === 1) {
              targets = [active[0].name];
            } else if (active.length === 0) {
              throw new Error('No active changes. Run "agentic-fy propose <name>".');
            } else {
              throw new Error(
                `There are multiple active changes (${active
                  .map((c) => c.name)
                  .join(', ')}). Provide the name or use --all.`
              );
            }
          }

          const reports = await Promise.all(
            targets.map((t) => validateChange(root, t, options.strict))
          );

          if (options.json) {
            console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
          } else {
            for (const report of reports) {
              const head = report.valid
                ? chalk.green(`✓ ${report.change} — valid`)
                : chalk.red(`✗ ${report.change} — has issues`);
              console.log(head);
              for (const issue of report.issues) {
                const line = `  ${levelPrefix(issue.level)} [${issue.level}] ${issue.path}: ${issue.message}`;
                if (issue.level === 'ERROR') console.error(line);
                else console.log(line);
              }
            }
          }

          const anyInvalid = reports.some((r) => !r.valid);
          if (anyInvalid) process.exitCode = 1;
        } catch (error) {
          failWithError(error);
          process.exit(1);
        }
      }
    );

  // ─── status ──────────────────────────────────────────────────────────────
  program
    .command('status')
    .description('Overview of active changes: stage, progress, and issues')
    .option('--json', 'JSON output')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const status = await projectStatus(root);
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }
        if (status.total === 0) {
          console.log('No active changes. Run "agentic-fy propose <name>".');
          return;
        }
        const byStatus = Object.entries(status.byStatus)
          .map(([s, n]) => `${s}: ${n}`)
          .join(', ');
        console.log(chalk.bold(`Active changes: ${status.total}`) + chalk.dim(` (${byStatus})`));
        for (const c of status.changes) {
          const tasks = `tasks ${c.tasks.completed}/${c.tasks.total}`;
          const problems =
            c.errors > 0
              ? chalk.red(` ${c.errors} error(s)`)
              : c.warnings > 0
                ? chalk.yellow(` ${c.warnings} warning(s)`)
                : chalk.green(' ok');
          console.log(
            `  ${chalk.bold(c.name)} ${chalk.dim(`(${c.status})`)} — ${tasks} ·${problems}`
          );
        }
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  // ─── doctor ──────────────────────────────────────────────────────────────
  program
    .command('doctor')
    .description('Checks the project integrity (config, metadata, artifacts)')
    .option('--json', 'JSON output')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const report = await runDoctor(root);
        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else if (report.findings.length === 0) {
          console.log(chalk.green('✓ Healthy project, no issues found.'));
        } else {
          console.log(
            report.healthy
              ? chalk.yellow('Project with warnings:')
              : chalk.red('Project with issues:')
          );
          for (const f of report.findings) {
            const line = `  ${levelPrefix(f.level)} [${f.level}] ${f.scope}: ${f.message}`;
            if (f.level === 'ERROR') console.error(line);
            else console.log(line);
          }
        }
        if (!report.healthy) process.exitCode = 1;
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  // ─── context ───────────────────────────────────────────────────────────────
  program
    .command('context')
    .description('Gathers the project context (config, changes, specs) for the agent')
    .option('--json', 'JSON output')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const ctx = await projectContext(root);
        console.log(options.json ? JSON.stringify(ctx, null, 2) : renderContext(ctx));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
