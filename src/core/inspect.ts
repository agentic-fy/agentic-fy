import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { listChanges, readChange, changeDir, resolveProjectPaths, SPECS_DIR } from './change.js';
import { artifactStates, readArtifact, parseTasks } from './artifacts.js';
import { ARTIFACT_FILES, ChangeArtifact, CHANGE_ARTIFACTS } from './schema.js';

/**
 * Project inspection: list and show changes/specs.
 *
 * A lean rewrite of what the `list` and `show` commands of the reference
 * project (/base) do — without store, roots, deltas parser, or inquirer.
 * It works over agentic-fy's real artifacts (proposal/design/tasks + specs).
 */

// ─── Task progress ───────────────────────────────────────────────────────────

export interface TaskProgress {
  total: number;
  completed: number;
}

/** Counts tasks (checkboxes) from a change's tasks.md. */
export async function taskProgress(root: string, changeName: string): Promise<TaskProgress> {
  const content = await readArtifact(root, changeName, 'tasks');
  if (!content) {
    return { total: 0, completed: 0 };
  }
  const tasks = parseTasks(content);
  return { total: tasks.length, completed: tasks.filter((t) => t.done).length };
}

// ─── list ──────────────────────────────────────────────────────────────────────

export interface ChangeSummary {
  name: string;
  status: string;
  title: string;
  tasks: TaskProgress;
}

/** Extracts the title (first `# Heading`) from markdown; falls back otherwise. */
export function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  const title = match?.[1].trim();
  if (!title) return fallback;
  // The templates open with "Proposal — <name>"; that's a useful title, so
  // we only discard empty generic titles.
  return title;
}

/** Lists the active changes with status, title, and task progress. */
export async function listChangeSummaries(root: string): Promise<ChangeSummary[]> {
  const changes = await listChanges(root);
  const summaries = await Promise.all(
    changes.map(async (change): Promise<ChangeSummary> => {
      const proposal = await readArtifact(root, change.name, 'proposal');
      const title = proposal ? extractTitle(proposal, change.name) : change.name;
      return {
        name: change.name,
        status: change.metadata.status,
        title,
        tasks: await taskProgress(root, change.name),
      };
    })
  );
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

/** IDs of the project specs (files in agentic-fy/specs/). */
export async function listSpecIds(root: string): Promise<string[]> {
  const { specsDir } = resolveProjectPaths(root);
  if (!existsSync(specsDir)) return [];
  const entries = await fs.readdir(specsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))
    .map((e) => e.name.replace(/\.md$/, ''))
    .sort((a, b) => a.localeCompare(b));
}

// ─── show ────────────────────────────────────────────────────────────────────

export interface ChangeDetail {
  kind: 'change';
  name: string;
  status: string;
  title: string;
  tasks: TaskProgress;
  artifacts: { id: ChangeArtifact; file: string; exists: boolean }[];
  specs: string[];
}

/** Gathers a change's data for display (does not print anything). */
export async function showChange(root: string, name: string): Promise<ChangeDetail> {
  const change = await readChange(root, name);
  const proposal = await readArtifact(root, change.name, 'proposal');
  const states = artifactStates(root, change.name).map((s) => ({
    id: s.id,
    file: s.file,
    exists: s.exists,
  }));

  // The change's internal specs (agentic-fy/changes/<name>/specs/*.md).
  const changeSpecsDir = path.join(changeDir(root, change.name), SPECS_DIR);
  let specs: string[] = [];
  if (existsSync(changeSpecsDir)) {
    const entries = await fs.readdir(changeSpecsDir, { withFileTypes: true });
    specs = entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  }

  return {
    kind: 'change',
    name: change.name,
    status: change.metadata.status,
    title: proposal ? extractTitle(proposal, change.name) : change.name,
    tasks: await taskProgress(root, change.name),
    artifacts: states,
    specs,
  };
}

/** Reads the raw content of a change artifact (proposal/design/tasks). */
export async function readChangeArtifact(
  root: string,
  name: string,
  id: ChangeArtifact
): Promise<string> {
  const content = await readArtifact(root, name, id);
  if (content === null) {
    throw new Error(
      `Artifact "${ARTIFACT_FILES[id]}" not found in change "${name}".`
    );
  }
  return content;
}

/** Reads the raw content of a project spec (agentic-fy/specs/<id>.md). */
export async function readSpec(root: string, id: string): Promise<string> {
  const { specsDir } = resolveProjectPaths(root);
  const file = path.join(specsDir, `${id}.md`);
  // Guard against path traversal via id.
  if (path.dirname(path.resolve(file)) !== path.resolve(specsDir)) {
    throw new Error(`Invalid spec: "${id}".`);
  }
  if (!existsSync(file)) {
    throw new Error(`Spec "${id}" not found in ${file}.`);
  }
  return fs.readFile(file, 'utf8');
}

export const ALL_CHANGE_ARTIFACTS = CHANGE_ARTIFACTS;
