import { readProjectConfig } from './change.js';
import { listChangeSummaries, listSpecIds, ChangeSummary } from './inspect.js';

/**
 * `context`: brief do projeto para um agente de IA.
 *
 * Reescreve, enxuto, a ideia do `context` do projeto de referência (/base) —
 * lá voltado a "working set" entre stores/roots — para o modelo single-repo
 * do agentic: reúne, num só lugar, a config, as changes ativas (com estágio e
 * progresso) e as specs do projeto. Serve para o agente ler o estado inteiro
 * de uma vez. Função pura.
 */

export interface ProjectContext {
  root: string;
  schema: string;
  workflow: string[];
  changes: ChangeSummary[];
  specs: string[];
}

export async function projectContext(root: string): Promise<ProjectContext> {
  const config = await readProjectConfig(root);
  const [changes, specs] = await Promise.all([
    listChangeSummaries(root),
    listSpecIds(root),
  ]);
  return {
    root,
    schema: config.schema,
    workflow: config.workflow,
    changes,
    specs,
  };
}

/** Renderiza o contexto como texto legível (markdown-ish) para o agente. */
export function renderContext(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push(`# Contexto do projeto agentic`);
  lines.push('');
  lines.push(`Raiz: ${ctx.root}`);
  lines.push(`Schema: ${ctx.schema}`);
  lines.push(`Workflow: ${ctx.workflow.join(' → ')}`);
  lines.push('');

  lines.push(`## Changes ativas (${ctx.changes.length})`);
  if (ctx.changes.length === 0) {
    lines.push('Nenhuma change ativa.');
  } else {
    for (const c of ctx.changes) {
      lines.push(
        `- ${c.name} (${c.status}) — ${c.title} [tarefas ${c.tasks.completed}/${c.tasks.total}]`
      );
    }
  }
  lines.push('');

  lines.push(`## Specs do projeto (${ctx.specs.length})`);
  if (ctx.specs.length === 0) {
    lines.push('Nenhuma spec.');
  } else {
    for (const s of ctx.specs) lines.push(`- ${s}`);
  }

  return lines.join('\n');
}
