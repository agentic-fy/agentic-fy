import { readProjectConfig } from './change.js';
import { listChangeSummaries, listSpecIds, ChangeSummary } from './inspect.js';

/**
 * `context`: project brief for an AI agent.
 *
 * A lean rewrite of the `context` idea from the reference project (/base) —
 * there focused on a "working set" across stores/roots — for agentic-fy's
 * single-repo model: gathers, in one place, the config, the active changes
 * (with stage and progress), and the project specs. It lets the agent read the
 * entire state at once. Pure function.
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

/** Renders the context as readable text (markdown-ish) for the agent. */
export function renderContext(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push(`# agentic-fy project context`);
  lines.push('');
  lines.push(`Root: ${ctx.root}`);
  lines.push(`Schema: ${ctx.schema}`);
  lines.push(`Workflow: ${ctx.workflow.join(' → ')}`);
  lines.push('');

  lines.push(`## Active changes (${ctx.changes.length})`);
  if (ctx.changes.length === 0) {
    lines.push('No active changes.');
  } else {
    for (const c of ctx.changes) {
      lines.push(
        `- ${c.name} (${c.status}) — ${c.title} [tasks ${c.tasks.completed}/${c.tasks.total}]`
      );
    }
  }
  lines.push('');

  lines.push(`## Project specs (${ctx.specs.length})`);
  if (ctx.specs.length === 0) {
    lines.push('No specs.');
  } else {
    for (const s of ctx.specs) lines.push(`- ${s}`);
  }

  return lines.join('\n');
}
