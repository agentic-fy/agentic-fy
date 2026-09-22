import { readChange } from './change.js';
import { readArtifact, parseTasks, artifactTemplate } from './artifacts.js';
import { CHANGE_ARTIFACTS, ARTIFACT_FILES, ChangeArtifact } from './schema.js';

/**
 * Validation of a change's artifacts.
 *
 * A lean rewrite of the `validate` idea from the reference project (/base),
 * adapted to agentic-fy's model (proposal/design/tasks), WITHOUT the deltas
 * model (## ADDED/MODIFIED Requirements), without store/roots, and without dependencies.
 *
 * What the validation covers — each rule exists because the current `verify`
 * doesn't catch it and it represents an artifact that "looks ready but isn't":
 *  1. missing artifact;
 *  2. artifact still identical to the template (nobody wrote anything);
 *  3. artifact practically empty;
 *  4. tasks.md without any real checkbox (just loose text);
 *  5. (informational) tasks still pending.
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
