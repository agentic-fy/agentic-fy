import { listChangeSummaries, ChangeSummary } from './inspect.js';
import { validateChange } from './validate.js';

/**
 * `status`: project overview.
 *
 * A lean rewrite of the `workflow/status` idea from the reference project
 * (/base): a "dashboard" of the active changes — what stage they're in, how
 * many tasks remain, and whether there are validation issues. Reuses the
 * existing inspection and validation core. Pure function (does not print).
 */

export interface ChangeStatusEntry extends ChangeSummary {
  /** Issues found by the validation (count by level). */
  errors: number;
  warnings: number;
}

export interface ProjectStatus {
  total: number;
  byStatus: Record<string, number>;
  changes: ChangeStatusEntry[];
}

/** Builds the project status: per-change summary + aggregates. */
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
