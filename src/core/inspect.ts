import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { listChanges, readChange, changeDir, resolveProjectPaths, SPECS_DIR } from './change.js';
import { artifactStates, readArtifact, parseTasks } from './artifacts.js';
import { ARTIFACT_FILES, ChangeArtifact, CHANGE_ARTIFACTS } from './schema.js';

/**
 * Inspeção do projeto: listar e mostrar changes/specs.
 *
 * Reescreve, enxuto, o que os comandos `list` e `show` do projeto de
 * referência (/base) fazem — sem store, roots, parser de deltas nem inquirer.
 * Trabalha sobre os artefatos reais do agentic (proposal/design/tasks + specs).
 */

// ─── Progresso de tarefas ─────────────────────────────────────────────────────

export interface TaskProgress {
  total: number;
  completed: number;
}

/** Conta tarefas (checkboxes) do tasks.md de uma change. */
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

/** Extrai o título (primeiro `# Heading`) de um markdown; cai no fallback. */
export function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  const title = match?.[1].trim();
  if (!title) return fallback;
  // Os templates abrem com "Proposta — <nome>"; isso é um título útil, então
  // só descartamos títulos genéricos vazios.
  return title;
}

/** Lista as changes ativas com status, título e progresso de tarefas. */
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

/** IDs das specs do projeto (arquivos em agentic/specs/). */
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

/** Reúne os dados de uma change para exibição (não imprime nada). */
export async function showChange(root: string, name: string): Promise<ChangeDetail> {
  const change = await readChange(root, name);
  const proposal = await readArtifact(root, change.name, 'proposal');
  const states = artifactStates(root, change.name).map((s) => ({
    id: s.id,
    file: s.file,
    exists: s.exists,
  }));

  // Specs internas da change (agentic/changes/<nome>/specs/*.md).
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

/** Lê o conteúdo cru de um artefato de change (proposal/design/tasks). */
export async function readChangeArtifact(
  root: string,
  name: string,
  id: ChangeArtifact
): Promise<string> {
  const content = await readArtifact(root, name, id);
  if (content === null) {
    throw new Error(
      `Artefato "${ARTIFACT_FILES[id]}" não encontrado na change "${name}".`
    );
  }
  return content;
}

/** Lê o conteúdo cru de uma spec do projeto (agentic/specs/<id>.md). */
export async function readSpec(root: string, id: string): Promise<string> {
  const { specsDir } = resolveProjectPaths(root);
  const file = path.join(specsDir, `${id}.md`);
  // Guarda contra path traversal via id.
  if (path.dirname(path.resolve(file)) !== path.resolve(specsDir)) {
    throw new Error(`Spec inválida: "${id}".`);
  }
  if (!existsSync(file)) {
    throw new Error(`Spec "${id}" não encontrada em ${file}.`);
  }
  return fs.readFile(file, 'utf8');
}

export const ALL_CHANGE_ARTIFACTS = CHANGE_ARTIFACTS;
