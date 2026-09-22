import type { Command } from 'commander';
import { promises as fs } from 'fs';
import chalk from 'chalk';

import {
  requireProjectRoot,
  readProjectConfig,
  serializeProjectConfig,
  resolveProjectPaths,
} from '../core/change.js';
import { ProjectConfigSchema, ProjectConfig } from '../core/schema.js';

/**
 * `config` command: show and edit agentic-fy.config.yaml.
 *
 * A lean rewrite of the `config` idea from the reference project (/base):
 * read/change the project configuration from the CLI, with no store or profiles.
 * Every write goes through the schema (zod), so we never write invalid config.
 */

/** Scalar fields editable via `config set`. */
const SETTABLE = ['version', 'schema'] as const;

export function registerConfigCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  const config = program.command('config').description('Shows or edits agentic-fy.config.yaml');

  config
    .command('show')
    .description('Shows the current project configuration')
    .option('--json', 'JSON output')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const cfg = await readProjectConfig(root);
        if (options.json) {
          console.log(JSON.stringify(cfg, null, 2));
        } else {
          console.log(chalk.bold('agentic-fy.config.yaml'));
          console.log(`  version:  ${cfg.version}`);
          console.log(`  schema:   ${cfg.schema}`);
          console.log(`  workflow: ${cfg.workflow.join(' → ')}`);
        }
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  config
    .command('set <key> <value>')
    .description(`Sets a config value. Keys: ${SETTABLE.join(', ')}`)
    .action(async (key: string, value: string) => {
      try {
        const root = requireProjectRoot();
        const cfg = await readProjectConfig(root);

        const normalizedKey = key.trim().toLowerCase();
        if (!SETTABLE.includes(normalizedKey as (typeof SETTABLE)[number])) {
          throw new Error(
            `Key is not editable: "${key}". Editable: ${SETTABLE.join(', ')}.`
          );
        }

        const next: ProjectConfig = { ...cfg };
        if (normalizedKey === 'version') {
          const n = Number.parseInt(value, 10);
          if (!Number.isInteger(n) || n <= 0) {
            throw new Error(`version must be a positive integer (received: "${value}").`);
          }
          next.version = n;
        } else if (normalizedKey === 'schema') {
          next.schema = value.trim();
        }

        // Validate before writing; never write invalid config.
        const validated = ProjectConfigSchema.parse(next);
        const { configFile } = resolveProjectPaths(root);
        await fs.writeFile(configFile, serializeProjectConfig(validated), 'utf8');

        console.log(chalk.green(`config updated: ${normalizedKey} = ${value}`));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
