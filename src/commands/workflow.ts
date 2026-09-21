import type { Command } from 'commander';
import chalk from 'chalk';

import {
  runExplore,
  runPropose,
  runApply,
  runVerify,
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
 * Registra os 5 comandos de workflow. Cada handler apenas delega à função
 * pura correspondente em core/workflow.ts e formata a saída.
 */
export function registerWorkflowCommands(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('explore')
    .description('Mapeia o problema e entende a codebase (modo pensamento)')
    .action(async () => {
      try {
        printResult(await runExplore());
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('propose <nome>')
    .description('Cria a change e rascunha proposal.md, specs/, design.md, tasks.md')
    .action(async (nome: string) => {
      try {
        printResult(await runPropose(nome));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('apply [nome]')
    .description('Implementa as tarefas de tasks.md')
    .action(async (nome?: string) => {
      try {
        printResult(await runApply(nome));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('verify [nome]')
    .description('Verifica a implementação contra a spec')
    .action(async (nome?: string) => {
      try {
        printResult(await runVerify(nome));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  program
    .command('archive [nome]')
    .description('Arquiva a change concluída')
    .action(async (nome?: string) => {
      try {
        printResult(await runArchive(nome));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
