import chalk from 'chalk';

import { listChangeSummaries, listSpecIds, ChangeSummary } from './inspect.js';

/**
 * Dados e renderização do dashboard (`view`).
 *
 * Espelha o `view` do projeto de referência (/base) — um painel de specs e
 * changes com barras de progresso, agrupado por estágio — reescrito enxuto e
 * sem dependências além do chalk que o projeto já usa. Funções puras: montam
 * os dados e devolvem uma string; quem imprime é a camada de comando.
 */

export interface DashboardData {
  /** Changes ainda em rascunho (exploring/proposed). */
  draft: ChangeSummary[];
  /** Changes em andamento (applying). */
  active: ChangeSummary[];
  /** Changes prontas (verified). */
  done: ChangeSummary[];
  specs: string[];
  totals: { changes: number; specs: number; tasksTotal: number; tasksDone: number };
}

/** Classifica o status de uma change em um dos três grupos do painel. */
function bucketOf(status: string): 'draft' | 'active' | 'done' {
  if (status === 'applying') return 'active';
  if (status === 'verified') return 'done';
  return 'draft'; // exploring, proposed (e qualquer outro) contam como rascunho
}

export async function buildDashboard(root: string): Promise<DashboardData> {
  const [summaries, specs] = await Promise.all([
    listChangeSummaries(root),
    listSpecIds(root),
  ]);

  const draft: ChangeSummary[] = [];
  const active: ChangeSummary[] = [];
  const done: ChangeSummary[] = [];
  let tasksTotal = 0;
  let tasksDone = 0;

  for (const c of summaries) {
    tasksTotal += c.tasks.total;
    tasksDone += c.tasks.completed;
    const bucket = bucketOf(c.status);
    (bucket === 'active' ? active : bucket === 'done' ? done : draft).push(c);
  }

  return {
    draft,
    active,
    done,
    specs,
    totals: { changes: summaries.length, specs: specs.length, tasksTotal, tasksDone },
  };
}

/** Barra de progresso em blocos (largura fixa), estilo do /base. */
export function progressBar(completed: number, total: number, width = 20): string {
  if (total === 0) return chalk.dim('─'.repeat(width));
  const filled = Math.round((completed / total) * width);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
}

function pct(completed: number, total: number): string {
  const p = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `${p}%`;
}

/** Renderiza o dashboard estático como string. */
export function renderDashboard(data: DashboardData): string {
  const lines: string[] = [];
  const rule = '═'.repeat(60);
  const sub = '─'.repeat(60);

  lines.push('');
  lines.push(chalk.bold('Agentic Dashboard'));
  lines.push(rule);

  // Resumo.
  const { totals } = data;
  lines.push(
    `Changes: ${totals.changes}  ·  Specs: ${totals.specs}  ·  ` +
      `Tarefas: ${totals.tasksDone}/${totals.tasksTotal} (${pct(totals.tasksDone, totals.tasksTotal)})`
  );

  if (data.draft.length > 0) {
    lines.push('');
    lines.push(chalk.bold.gray('Rascunhos'));
    lines.push(sub);
    for (const c of data.draft) {
      lines.push(`  ${chalk.gray('○')} ${c.name} ${chalk.dim(`— ${c.title}`)}`);
    }
  }

  if (data.active.length > 0) {
    lines.push('');
    lines.push(chalk.bold.cyan('Em andamento'));
    lines.push(sub);
    for (const c of data.active) {
      const bar = progressBar(c.tasks.completed, c.tasks.total);
      lines.push(
        `  ${chalk.yellow('◉')} ${c.name.padEnd(28)} ${bar} ${chalk.dim(pct(c.tasks.completed, c.tasks.total))}`
      );
    }
  }

  if (data.done.length > 0) {
    lines.push('');
    lines.push(chalk.bold.green('Prontas (verified)'));
    lines.push(sub);
    for (const c of data.done) {
      lines.push(`  ${chalk.green('✓')} ${c.name} ${chalk.dim(`— ${c.title}`)}`);
    }
  }

  if (data.specs.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Specs'));
    lines.push(sub);
    for (const s of data.specs) lines.push(`  • ${s}`);
  }

  if (data.totals.changes === 0 && data.specs.length === 0) {
    lines.push('');
    lines.push(chalk.dim('Projeto vazio. Rode "agentic propose <nome>" para começar.'));
  }

  lines.push('');
  lines.push(rule);
  return lines.join('\n');
}
