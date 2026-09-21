import type { Command } from 'commander';
import chalk from 'chalk';

import { requireProjectRoot } from '../core/change.js';
import { buildDashboard, renderDashboard, DashboardData } from '../core/dashboard.js';
import { showChange, readSpec, ChangeSummary } from '../core/inspect.js';

/**
 * Comando `view`: dashboard de specs e changes.
 *
 * Espelha o `view` do projeto de referência (/base) — que é um painel
 * estático — e vai além: quando há terminal interativo (TTY), abre um modo
 * navegável por número (readline nativo, sem dependências). `--static` força
 * o painel estático; `--json` devolve os dados crus.
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
    .description('Dashboard de specs e changes (interativo no terminal)')
    .option('--static', 'Imprime o painel estático e sai (sem navegação)')
    .option('--json', 'Saída em JSON dos dados do dashboard')
    .action(async (options: { static?: boolean; json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const data = await buildDashboard(root);

        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        // Painel estático: quando pedido, ou quando não há TTY para navegar.
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

/** Loop interativo: mostra o painel + um menu numerado; navega para o detalhe. */
async function runInteractive(root: string, initial: DashboardData): Promise<void> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    let data = initial;
    for (;;) {
      // Lista unificada e numerada: todas as changes (por estágio) + specs.
      const changes: ChangeSummary[] = [...data.active, ...data.draft, ...data.done];
      const items: Array<{ kind: 'change' | 'spec'; id: string }> = [
        ...changes.map((c) => ({ kind: 'change' as const, id: c.name })),
        ...data.specs.map((s) => ({ kind: 'spec' as const, id: s })),
      ];

      console.clear();
      console.log(renderDashboard(data));
      console.log('');
      if (items.length === 0) {
        console.log(chalk.dim('Nada para inspecionar. (q para sair)'));
      } else {
        console.log(chalk.bold('Selecione um item para ver o detalhe:'));
        items.forEach((it, i) => {
          const tag = it.kind === 'change' ? chalk.cyan('change') : chalk.magenta('spec');
          console.log(`  ${String(i + 1).padStart(2)}) [${tag}] ${it.id}`);
        });
      }

      const answer = (await rl.question('\nNúmero para abrir, "r" para atualizar, "q" para sair: ')).trim().toLowerCase();

      if (answer === 'q' || answer === '') {
        if (answer === 'q') break;
        // Enter sem número: apenas re-renderiza.
        continue;
      }
      if (answer === 'r') {
        data = await buildDashboard(root);
        continue;
      }

      const index = Number.parseInt(answer, 10);
      if (!Number.isInteger(index) || index < 1 || index > items.length) {
        continue; // entrada inválida: volta ao painel
      }

      const item = items[index - 1];
      console.clear();
      if (item.kind === 'change') {
        const d = await showChange(root, item.id);
        console.log(chalk.bold(`${d.name}`) + chalk.dim(` (${d.status})`));
        console.log(`Título: ${d.title}`);
        console.log(`Tarefas: ${d.tasks.completed}/${d.tasks.total} concluídas`);
        console.log('Artefatos:');
        for (const a of d.artifacts) {
          console.log(`  ${a.exists ? chalk.green('✓') : chalk.red('✗')} ${a.file}`);
        }
        if (d.specs.length > 0) console.log(`Specs da change: ${d.specs.join(', ')}`);
      } else {
        console.log(chalk.bold(`spec: ${item.id}`));
        console.log('');
        console.log(await readSpec(root, item.id));
      }

      await rl.question(chalk.dim('\n[Enter] para voltar ao dashboard...'));
    }
  } finally {
    rl.close();
  }
}
