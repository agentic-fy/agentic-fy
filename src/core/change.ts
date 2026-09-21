import { promises as fs, existsSync } from 'fs';
import path from 'path';
import YAML from 'yaml';

import {
  ChangeMetadata,
  ChangeMetadataSchema,
  ChangeStatus,
  ProjectConfig,
  ProjectConfigSchema,
  DEFAULT_PROJECT_CONFIG,
} from './schema.js';

export const AGENTIC_DIR = 'agentic';
export const CHANGES_DIR = 'changes';
export const ARCHIVE_DIR = 'archive';
export const SPECS_DIR = 'specs';
export const CONFIG_FILE = 'agentic.config.yaml';
export const METADATA_FILE = '.agentic.yaml';

/** Caminhos derivados a partir da raiz do projeto. */
export interface ProjectPaths {
  root: string;
  configFile: string;
  agenticDir: string;
  specsDir: string;
  changesDir: string;
  archiveDir: string;
}

export function resolveProjectPaths(root: string): ProjectPaths {
  const agenticDir = path.join(root, AGENTIC_DIR);
  return {
    root,
    configFile: path.join(root, CONFIG_FILE),
    agenticDir,
    specsDir: path.join(agenticDir, SPECS_DIR),
    changesDir: path.join(agenticDir, CHANGES_DIR),
    archiveDir: path.join(agenticDir, CHANGES_DIR, ARCHIVE_DIR),
  };
}

/**
 * Sobe na árvore de diretórios procurando um projeto agentic inicializado
 * (presença de `agentic.config.yaml`). Retorna a raiz ou null.
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);
  // Loop até a raiz do filesystem.
  for (;;) {
    if (existsSync(path.join(current, CONFIG_FILE))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/** Resolve a raiz do projeto ou lança um erro acionável. */
export function requireProjectRoot(startDir: string = process.cwd()): string {
  const root = findProjectRoot(startDir);
  if (!root) {
    throw new Error(
      `Projeto agentic não encontrado (nenhum ${CONFIG_FILE} nos diretórios acima). ` +
        `Rode "agentic init" primeiro.`
    );
  }
  return root;
}

// ─── Config ────────────────────────────────────────────────────────────────

export async function readProjectConfig(root: string): Promise<ProjectConfig> {
  const configFile = path.join(root, CONFIG_FILE);
  if (!existsSync(configFile)) {
    return { ...DEFAULT_PROJECT_CONFIG };
  }
  const raw = await fs.readFile(configFile, 'utf8');
  const parsed = YAML.parse(raw) ?? {};
  return ProjectConfigSchema.parse(parsed);
}

export function serializeProjectConfig(config: ProjectConfig): string {
  return YAML.stringify(ProjectConfigSchema.parse(config));
}

// ─── Changes ─────────────────────────────────────────────────────────────────

export interface Change {
  name: string;
  dir: string;
  metadata: ChangeMetadata;
}

/** Normaliza um nome de change para um slug seguro em disco. */
export function normalizeChangeName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new Error(`Nome de change inválido: "${name}"`);
  }
  return slug;
}

export function changeDir(root: string, name: string): string {
  return path.join(resolveProjectPaths(root).changesDir, name);
}

export function changeExists(root: string, name: string): boolean {
  return existsSync(path.join(changeDir(root, name), METADATA_FILE));
}

/**
 * Cria uma nova change com estrutura base (specs/ e metadata).
 * Idempotente: se já existir, apenas retorna a change atual.
 */
export async function createChange(
  root: string,
  rawName: string,
  status: ChangeStatus = 'exploring'
): Promise<Change> {
  const name = normalizeChangeName(rawName);
  const dir = changeDir(root, name);

  if (changeExists(root, name)) {
    return readChange(root, name);
  }

  await fs.mkdir(path.join(dir, SPECS_DIR), { recursive: true });

  const now = new Date().toISOString();
  const metadata = ChangeMetadataSchema.parse({
    name,
    status,
    createdAt: now,
    updatedAt: now,
  });
  await writeChangeMetadata(root, metadata);

  return { name, dir, metadata };
}

export async function readChange(root: string, rawName: string): Promise<Change> {
  const name = normalizeChangeName(rawName);
  const dir = changeDir(root, name);
  const metaFile = path.join(dir, METADATA_FILE);
  if (!existsSync(metaFile)) {
    throw new Error(`Change "${name}" não encontrada em ${dir}`);
  }
  const raw = await fs.readFile(metaFile, 'utf8');
  const metadata = ChangeMetadataSchema.parse(YAML.parse(raw) ?? {});
  return { name, dir, metadata };
}

export async function writeChangeMetadata(root: string, metadata: ChangeMetadata): Promise<void> {
  const validated = ChangeMetadataSchema.parse(metadata);
  const dir = changeDir(root, validated.name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, METADATA_FILE), YAML.stringify(validated), 'utf8');
}

/** Atualiza o status de uma change e o carimbo updatedAt. */
export async function setChangeStatus(
  root: string,
  rawName: string,
  status: ChangeStatus
): Promise<Change> {
  const change = await readChange(root, rawName);
  const metadata: ChangeMetadata = {
    ...change.metadata,
    status,
    updatedAt: new Date().toISOString(),
  };
  await writeChangeMetadata(root, metadata);
  return { ...change, metadata };
}

/** Lista todas as changes ativas (fora do archive). */
export async function listChanges(root: string): Promise<Change[]> {
  const { changesDir } = resolveProjectPaths(root);
  if (!existsSync(changesDir)) {
    return [];
  }
  const entries = await fs.readdir(changesDir, { withFileTypes: true });
  const changes: Change[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ARCHIVE_DIR) {
      continue;
    }
    if (changeExists(root, entry.name)) {
      changes.push(await readChange(root, entry.name));
    }
  }
  return changes;
}

/** Move uma change concluída para `agentic/changes/archive/<nome>/`. */
export async function archiveChange(root: string, rawName: string): Promise<string> {
  const name = normalizeChangeName(rawName);
  const from = changeDir(root, name);
  if (!existsSync(from)) {
    throw new Error(`Change "${name}" não encontrada para arquivar`);
  }
  const { archiveDir } = resolveProjectPaths(root);
  await fs.mkdir(archiveDir, { recursive: true });
  const to = path.join(archiveDir, name);
  if (existsSync(to)) {
    throw new Error(`Já existe uma change arquivada com o nome "${name}"`);
  }
  await setChangeStatus(root, name, 'archived');
  await fs.rename(from, to);
  return to;
}
