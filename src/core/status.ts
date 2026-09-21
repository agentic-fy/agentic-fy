import { listChangeSummaries, ChangeSummary } from './inspect.js';
import { validateChange } from './validate.js';

/**
 * `status`: panorama do projeto.
 *
 * Reescreve, enxuto, a ideia do `workflow/status` do projeto de referência
 * (/base): um "dashboard" das changes ativas — em que estágio estão, quanto
 * falta de tarefas e se há problemas de validação. Reaproveita o core de
 * inspeção e validação já existente. Função pura (não imprime).
 */

export interface ChangeStatusEntry extends ChangeSummary {
  /** Problemas encontrados pela validação (contagem por nível). */
  errors: number;
  warnings: number;
}

export interface ProjectStatus {
  total: number;
  byStatus: Record<string, number>;
  changes: ChangeStatusEntry[];
}

/** Monta o status do projeto: resumo por change + agregados. */
export async function projectStatus(root: string): Promise<ProjectStatus> {
  const summaries = await listChangeSummaries(root);

  const changes: ChangeStatusEntry[] = await Promise.all(
    summaries.map(async (summary): Promise<ChangeStatusEntry> => {
      const report = await validateChange(root, summary.name);
      return {
        ...summary,
        errors: report.summary.errors,
        warnings: report.summary.warnings,
      };
    })
  );

  const byStatus: Record<string, number> = {};
  for (const c of changes) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  }

  return { total: changes.length, byStatus, changes };
}
