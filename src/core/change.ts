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

export const AGENTIC_DIR = 'agentic-fy';
export const CHANGES_DIR = 'changes';
export const ARCHIVE_DIR = 'archive';
export const SPECS_DIR = 'specs';
export const CONFIG_FILE = 'agentic-fy.config.yaml';
export const METADATA_FILE = '.agentic-fy.yaml';

/** Paths derived from the project root. */
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
 * Walks up the directory tree looking for an initialized agentic-fy project
 * (presence of `agentic-fy.config.yaml`). Returns the root or null.
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);
  // Loop up to the filesystem root.
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

/** Resolves the project root or throws an actionable error. */
export function requireProjectRoot(startDir: string = process.cwd()): string {
  const root = findProjectRoot(startDir);
  if (!root) {
    throw new Error(
      `agentic-fy project not found (no ${CONFIG_FILE} in the directories above). ` +
        `Run "agentic-fy init" first.`
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

/** Normalizes a change name into a disk-safe slug. */
export function normalizeChangeName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new Error(`Invalid change name: "${name}"`);
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
 * Creates a new change with the base structure (specs/ and metadata).
 * Idempotent: if it already exists, it just returns the current change.
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
    throw new Error(`Change "${name}" not found in ${dir}`);
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

/** Updates a change's status and the updatedAt timestamp. */
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

/** Lists all active changes (outside the archive). */
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

/** Moves a completed change to `agentic-fy/changes/archive/<name>/`. */
export async function archiveChange(root: string, rawName: string): Promise<string> {
  const name = normalizeChangeName(rawName);
  const from = changeDir(root, name);
  if (!existsSync(from)) {
    throw new Error(`Change "${name}" not found to archive`);
  }
  const { archiveDir } = resolveProjectPaths(root);
  await fs.mkdir(archiveDir, { recursive: true });
  const to = path.join(archiveDir, name);
  if (existsSync(to)) {
    throw new Error(`An archived change with the name "${name}" already exists`);
  }
  await setChangeStatus(root, name, 'archived');
  await fs.rename(from, to);
  return to;
}
