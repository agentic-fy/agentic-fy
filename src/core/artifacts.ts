import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { ARTIFACT_FILES, ChangeArtifact, CHANGE_ARTIFACTS } from './schema.js';
import { changeDir, SPECS_DIR } from './change.js';

export interface ArtifactState {
  id: ChangeArtifact;
  file: string;
  path: string;
  exists: boolean;
}

/** Caminho absoluto de um artefato dentro de uma change. */
export function artifactPath(root: string, changeName: string, id: ChangeArtifact): string {
  return path.join(changeDir(root, changeName), ARTIFACT_FILES[id]);
}

/** Estado (existe ou não) de todos os artefatos de uma change. */
export function artifactStates(root: string, changeName: string): ArtifactState[] {
  return CHANGE_ARTIFACTS.map((id) => {
    const p = artifactPath(root, changeName, id);
    return { id, file: ARTIFACT_FILES[id], path: p, exists: existsSync(p) };
  });
}

export async function readArtifact(
  root: string,
  changeName: string,
  id: ChangeArtifact
): Promise<string | null> {
  const p = artifactPath(root, changeName, id);
  if (!existsSync(p)) {
    return null;
  }
  return fs.readFile(p, 'utf8');
}

/**
 * Escreve um artefato. Por padrão não sobrescreve conteúdo existente
 * (para não destruir trabalho); use `overwrite` para forçar.
 */
export async function writeArtifact(
  root: string,
  changeName: string,
  id: ChangeArtifact,
  content: string,
  overwrite = false
): Promise<{ path: string; written: boolean }> {
  const p = artifactPath(root, changeName, id);
  if (existsSync(p) && !overwrite) {
    return { path: p, written: false };
  }
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf8');
  return { path: p, written: true };
}

/** Escreve um arquivo de spec dentro de `<change>/specs/`. */
export async function writeSpec(
  root: string,
  changeName: string,
  specFile: string,
  content: string,
  overwrite = false
): Promise<{ path: string; written: boolean }> {
  const dir = path.join(changeDir(root, changeName), SPECS_DIR);
  const p = path.join(dir, specFile);
  if (existsSync(p) && !overwrite) {
    return { path: p, written: false };
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(p, content, 'utf8');
  return { path: p, written: true };
}

// ─── Templates dos artefatos ─────────────────────────────────────────────────

export function proposalTemplate(changeName: string): string {
  return `# Proposta — ${changeName}

## Por quê
Descreva o problema e a motivação.

## O quê
Resumo da mudança proposta e do resultado esperado.

## Escopo
- Dentro do escopo:
- Fora do escopo:
`;
}

export function designTemplate(changeName: string): string {
  return `# Design — ${changeName}

## Contexto
Decisões técnicas e restrições relevantes.

## Arquitetura
Componentes, fluxos e integrações.

## Alternativas consideradas
- Opção A:
- Opção B:

## Riscos
- Risco / mitigação:
`;
}

export function tasksTemplate(changeName: string): string {
  return `# Tarefas — ${changeName}

Plano de implementação incremental.

- [ ] 1. Primeira tarefa
- [ ] 2. Segunda tarefa
`;
}

export function specTemplate(changeName: string): string {
  return `# Requisitos — ${changeName}

## Visão geral
Descreva o objetivo.

## Requisitos
### R1 — Título
O sistema DEVE ...

Critérios de aceite:
- ...
`;
}

/** Retorna o template do artefato a partir do id. */
export function artifactTemplate(id: ChangeArtifact, changeName: string): string {
  switch (id) {
    case 'proposal':
      return proposalTemplate(changeName);
    case 'design':
      return designTemplate(changeName);
    case 'tasks':
      return tasksTemplate(changeName);
  }
}

/** Extrai as linhas de tarefa (checkbox) de um conteúdo de tasks.md. */
export interface TaskLine {
  raw: string;
  done: boolean;
  text: string;
}

export function parseTasks(content: string): TaskLine[] {
  const tasks: TaskLine[] = [];
  const re = /^\s*[-*]\s*\[([ xX])\]\s+(.*)$/;
  for (const line of content.split(/\r?\n/)) {
    const m = re.exec(line);
    if (m) {
      tasks.push({ raw: line, done: m[1].toLowerCase() === 'x', text: m[2].trim() });
    }
  }
  return tasks;
}
