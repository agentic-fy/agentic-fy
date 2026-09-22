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

/** Absolute path of an artifact within a change. */
export function artifactPath(root: string, changeName: string, id: ChangeArtifact): string {
  return path.join(changeDir(root, changeName), ARTIFACT_FILES[id]);
}

/** State (exists or not) of all artifacts of a change. */
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
 * Writes an artifact. By default it does not overwrite existing content
 * (so as not to destroy work); use `overwrite` to force it.
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

/** Writes a spec file inside `<change>/specs/`. */
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

// ─── Artifact templates ──────────────────────────────────────────────────────

export function proposalTemplate(changeName: string): string {
  return `# Proposal — ${changeName}

## Why
Describe the problem and the motivation.

## What
Summary of the proposed change and the expected outcome.

## Scope
- In scope:
- Out of scope:
`;
}

export function designTemplate(changeName: string): string {
  return `# Design — ${changeName}

## Context
Relevant technical decisions and constraints.

## Architecture
Components, flows, and integrations.

## Alternatives considered
- Option A:
- Option B:

## Risks
- Risk / mitigation:
`;
}

export function tasksTemplate(changeName: string): string {
  return `# Tasks — ${changeName}

Incremental implementation plan.

- [ ] 1. First task
- [ ] 2. Second task
`;
}

export function specTemplate(changeName: string): string {
  return `# Requirements — ${changeName}

## Overview
Describe the goal.

## Requirements
### R1 — Title
The system SHALL ...

Acceptance criteria:
- ...
`;
}

/** Returns the artifact template from the id. */
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

/** Extracts the task lines (checkboxes) from tasks.md content. */
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
