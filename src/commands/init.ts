import type { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';

import { initProject, type InitPhase } from '../core/init.js';
import { selectTools, canPromptInteractively } from '../core/tool-selection.js';
import { ALL_TOOL_IDS } from '../core/tools.js';
import { startStep, type Spinner } from '../ui/spinner.js';
import { renderBanner } from '../ui/version.js';

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
        // The interactive tool prompt renders its own banner/header. It only
        // runs when no --tools flag is given AND there's a TTY. In every other
        // path (--tools provided, or non-interactive) the prompt never shows,
        // so we print the logo here — otherwise init would have no banner at
        // all. The condition mirrors selectTools' decision, avoiding a double
        // logo when the prompt does show it.
        const noColor = () => process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true';
        const promptWillShowLogo = options.tools === undefined && canPromptInteractively();
        if (!promptWillShowLogo) {
          console.log();
          console.log(renderBanner(!noColor()));
        }

        // 1. Select the tools (flag > interactive prompt > none).
        const tools = await selectTools(path.resolve(targetPath), { toolsFlag: options.tools });

        // Cancelled at the prompt (Esc / Ctrl-C): abort without creating anything.
        if (tools === null) {
          console.log(chalk.dim('Cancelled. No project was created.'));
          return;
        }

        // 2. Create the structure and configure the selected tools, with a
        //    per-phase spinner. The in-progress label per phase; the ✓ carries
        //    the detail the core reports. No artificial delay — a spinner only
        //    shows frames if the work actually takes time.
        const toolList = tools.map((t) => t.id).join(', ');
        const labels: Record<InitPhase, string> = {
          structure: 'Creating project structure...',
          config: 'Writing agentic-fy.config.yaml...',
          tools: `Configuring MCP${toolList ? ` (${toolList})` : ''}...`,
          skills: 'Generating commands & skills...',
        };
        let active: Spinner | null = null;

        console.log();
        const result = await initProject(targetPath, tools, {
          onProgress: (event) => {
            if (event.stage === 'start') {
              active = startStep(labels[event.phase], { delay: 150 });
            } else if (active) {
              active.succeed(event.detail ?? labels[event.phase]);
              active = null;
            }
          },
        });
        const rel = (p: string) => path.relative(result.root, p) || '.';

        console.log(chalk.green('✓') + ' Project initialized');
        console.log();
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
