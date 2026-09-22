import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { readChange, changeDir, SPECS_DIR } from './change.js';
import { readArtifact, parseTasks, artifactTemplate } from './artifacts.js';
import { CHANGE_ARTIFACTS, ARTIFACT_FILES, ChangeArtifact } from './schema.js';
import { parseSpecDelta, specDeltaTemplate } from './spec-delta.js';

/**
 * Validation of a change's artifacts.
 *
 * A lean rewrite of the `validate` idea from the reference project (/base),
 * adapted to agentic-fy's model (proposal/design/tasks + YAML spec deltas).
 *
 * What the validation covers — each rule exists because the current `verify`
 * doesn't catch it and it represents an artifact that "looks ready but isn't":
 *  1. missing artifact;
 *  2. artifact still identical to the template (nobody wrote anything);
 *  3. artifact practically empty;
 *  4. tasks.md without any real checkbox (just loose text);
 *  5. (informational) tasks still pending;
 *  6. spec deltas: malformed YAML / invalid structure / still the template.
 */

export type IssueLevel = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  level: IssueLevel;
  path: string;
  message: string;
}

export interface ValidationReport {
  change: string;
  valid: boolean;
  issues: ValidationIssue[];
  summary: { errors: number; warnings: number; info: number };
}

/** Normalizes markdown for structural comparison (ignores spaces/blank lines). */
function normalize(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
    .trim();
}

/** "Real" artifact content: strips headings, comments, and empty bullets. */
function meaningfulBody(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith('#')) // template headings
    .filter((l) => !/^<!--.*-->$/.test(l)) // comments
    .filter((l) => !/^[-*]\s*$/.test(l)) // empty bullets "- "
    .join('\n')
    .trim();
}

const MIN_BODY_LENGTH = 24;

/** Validates a single change artifact, returning issues. */
function validateArtifact(
  id: ChangeArtifact,
  changeName: string,
  content: string | null
): ValidationIssue[] {
  const file = ARTIFACT_FILES[id];
  if (content === null) {
    return [{ level: 'ERROR', path: file, message: `Missing artifact: ${file}.` }];
  }

  const issues: ValidationIssue[] = [];

  // Identical to the template = nobody filled it in.
  if (normalize(content) === normalize(artifactTemplate(id, changeName))) {
    issues.push({
      level: 'WARNING',
      path: file,
      message: `${file} still has the template content (it was not filled in).`,
    });
    return issues; // no point stacking "practically empty" on top
  }

  // Real body too short.
  if (meaningfulBody(content).length < MIN_BODY_LENGTH) {
    issues.push({
      level: 'WARNING',
      path: file,
      message: `${file} is practically empty; describe the real content.`,
    });
  }

  return issues;
}

/** Validates tasks.md beyond the generic artifact checks. */
function validateTasks(content: string | null): ValidationIssue[] {
  if (content === null) return []; // absence already reported in validateArtifact
  const issues: ValidationIssue[] = [];
  const tasks = parseTasks(content);

  if (tasks.length === 0) {
    // There is text/bullets, but no checkbox: verify would count "0 tasks" and
    // pass unnoticed. Mirrors the checkbox warning from /base.
    const hasBullets = /^\s*[-*+]\s+\S/m.test(content);
    issues.push({
      level: 'ERROR',
      path: ARTIFACT_FILES.tasks,
      message: hasBullets
        ? 'tasks.md has list items, but none is a checkbox. Write "- [ ] description".'
        : 'tasks.md does not define any task (checkbox "- [ ]").',
    });
    return issues;
  }

  const pending = tasks.filter((t) => !t.done).length;
  if (pending > 0) {
    issues.push({
      level: 'INFO',
      path: ARTIFACT_FILES.tasks,
      message: `${pending} of ${tasks.length} task(s) still pending.`,
    });
  }
  return issues;
}

/**
 * Validates the change's YAML spec deltas (`specs/*.delta.yaml`).
 *
 * Each delta is parsed and schema-validated: malformed YAML or an invalid
 * structure is a hard ERROR (with the file name), and a delta still holding the
 * untouched template is a WARNING. A change with no delta files at all is only
 * an INFO — a pure refactor legitimately changes no specs.
 */
async function validateSpecDeltas(root: string, changeName: string): Promise<ValidationIssue[]> {
  const dir = path.join(changeDir(root, changeName), SPECS_DIR);
  if (!existsSync(dir)) {
    return [{ level: 'INFO', path: 'specs/', message: 'No specs/ directory; no spec deltas to validate.' }];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const deltaFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.delta.yaml'))
    .map((e) => e.name)
    .sort();

  if (deltaFiles.length === 0) {
    return [{ level: 'INFO', path: 'specs/', message: 'No spec deltas (*.delta.yaml) in this change.' }];
  }

  const issues: ValidationIssue[] = [];
  for (const file of deltaFiles) {
    const rel = `specs/${file}`;
    const content = await fs.readFile(path.join(dir, file), 'utf8');

    // Untouched template = nobody filled it in.
    const capabilityFromName = file.replace(/\.delta\.yaml$/, '');
    if (normalize(content) === normalize(specDeltaTemplate(capabilityFromName))) {
      issues.push({
        level: 'WARNING',
        path: rel,
        message: `${rel} still has the delta template (it was not filled in).`,
      });
      continue;
    }

    try {
      parseSpecDelta(content, rel);
    } catch (error) {
      issues.push({
        level: 'ERROR',
        path: rel,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return issues;
}

/**
 * Validates an entire change. `strict` promotes WARNING to fatal (affects `valid`),
 * mirroring `--strict` from /base.
 */
export async function validateChange(
  root: string,
  name: string,
  strict = false
): Promise<ValidationReport> {
  const change = await readChange(root, name); // throws if it does not exist
  const issues: ValidationIssue[] = [];

  const contents = new Map<ChangeArtifact, string | null>();
  for (const id of CHANGE_ARTIFACTS) {
    const content = await readArtifact(root, change.name, id);
    contents.set(id, content);
    issues.push(...validateArtifact(id, change.name, content));
  }

  issues.push(...validateTasks(contents.get('tasks') ?? null));
  issues.push(...(await validateSpecDeltas(root, change.name)));

  const errors = issues.filter((i) => i.level === 'ERROR').length;
  const warnings = issues.filter((i) => i.level === 'WARNING').length;
  const info = issues.filter((i) => i.level === 'INFO').length;

  const valid = errors === 0 && (!strict || warnings === 0);

  return {
    change: change.name,
    valid,
    issues,
    summary: { errors, warnings, info },
  };
}
