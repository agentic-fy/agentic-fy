import type { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';

import { initProject } from '../core/init.js';
import { selectTools } from '../core/tool-selection.js';
import { ALL_TOOL_IDS } from '../core/tools.js';

/**
 * Registers the `init` command, which creates the base project structure
 * (directories + agentic-fy.config.yaml) and, optionally, configures the MCP
 * integration for the selected AI tools.
 */
export function registerInitCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('init [path]')
    .description('Creates the base agentic-fy project structure and integrates the AI tools')
    .option(
      '--tools <list>',
      `Tools to configure without a prompt: all | none | ${ALL_TOOL_IDS.join(',')}`
    )
    .action(async (targetPath = '.', options: { tools?: string }) => {
      try {
        // 1. Select the tools (flag > interactive prompt > none).
        const tools = await selectTools(path.resolve(targetPath), { toolsFlag: options.tools });

        // 2. Create the structure and configure the selected tools.
        const result = await initProject(targetPath, tools);
        const rel = (p: string) => path.relative(result.root, p) || '.';

        console.log(chalk.bold('agentic-fy project initialized'));
        console.log(`Root: ${result.root}`);
        if (result.createdDirs.length > 0) {
          console.log('Created directories:');
          for (const dir of result.createdDirs) {
            console.log(`  ${rel(dir)}`);
          }
        } else {
          console.log(chalk.dim('Structure already existed (nothing new to create).'));
        }
        console.log(
          result.configStatus === 'created'
            ? 'Config: agentic-fy.config.yaml (created)'
            : chalk.dim('Config: agentic-fy.config.yaml (already existed)')
        );

        // 3. Report the integration of each tool.
        if (result.tools.length > 0) {
          console.log('Tools (MCP):');
          for (const t of result.tools) {
            const label =
              t.outcome === 'created'
                ? chalk.green('configured')
                : t.outcome === 'updated'
                  ? chalk.green('updated')
                  : chalk.dim('unchanged');
            console.log(`  ${t.tool.name}: ${label} — ${rel(t.file)}`);
          }
        } else {
          console.log(
            chalk.dim(
              'No tools configured. Use "agentic-fy init --tools kiro,cursor" to integrate.'
            )
          );
        }

        // 4. Report generated slash commands / skills.
        if (result.skills.length > 0) {
          console.log('Commands & skills:');
          for (const s of result.skills) {
            const cmd = s.commands;
            const sk = s.skills;
            const written = cmd.created + cmd.updated + sk.created + sk.updated;
            const label =
              written > 0
                ? chalk.green(
                    `${cmd.created + cmd.updated} command(s), ${sk.created + sk.updated} skill(s)`
                  )
                : chalk.dim('up to date');
            console.log(`  ${s.tool.name}: ${label} — ${rel(path.join(result.root, s.tool.skillsDir ?? ''))}`);
          }
        }

        console.log();
        console.log(chalk.dim('Next step: agentic-fy propose "your idea"'));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
