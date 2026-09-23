import {
  requireProjectRoot,
  createChange,
  readChange,
  setChangeStatus,
  listChanges,
  archiveChange,
} from './change.js';
import {
  artifactStates,
  writeArtifact,
  writeSpec,
  artifactTemplate,
  readArtifact,
  parseTasks,
} from './artifacts.js';
import { CHANGE_ARTIFACTS } from './schema.js';
import { specDeltaTemplate } from './spec-delta.js';
import { applyChangeSpecs } from './spec-merge.js';

/**
 * Pure workflow functions. They are the shared core: both the CLI handlers
 * and the MCP tools delegate here, avoiding logic duplication.
 * Each function returns a structured result; formatting is left to the
 * presentation layer (CLI or MCP).
 */

export interface WorkflowResult {
  action: string;
  change?: string;
  status?: string;
  messages: string[];
}

// ─── explore ─────────────────────────────────────────────────────────────────

export async function runExplore(cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const list = await listChanges(root);
  const messages = [
    'Explore mode: map the problem and the codebase (does not implement).',
    'When you are ready, use "propose <name>" to capture the change.',
    list.length > 0
      ? `Active changes: ${list.map((c) => `${c.name} (${c.metadata.status})`).join(', ')}`
      : 'No active changes yet.',
  ];
  return { action: 'explore', messages };
}

// ─── propose ─────────────────────────────────────────────────────────────────

export async function runPropose(name: string, cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const existed = false; // createChange is idempotent; we record what was created
  const change = await createChange(root, name, 'proposed');
  const messages: string[] = [];

  // Draft the artifacts (proposal, design, tasks) without overwriting existing ones.
  for (const id of CHANGE_ARTIFACTS) {
    const res = await writeArtifact(root, change.name, id, artifactTemplate(id, change.name));
    messages.push(res.written ? `Created: ${id}.md` : `Kept: ${id}.md (already existed)`);
  }

  // Draft an initial spec delta (YAML) for the change's own capability.
  const deltaFile = `${change.name}.delta.yaml`;
  const spec = await writeSpec(root, change.name, deltaFile, specDeltaTemplate(change.name));
  messages.push(
    spec.written ? `Created: specs/${deltaFile}` : `Kept: specs/${deltaFile} (already existed)`
  );

  await setChangeStatus(root, change.name, 'proposed');

  void existed;
  return { action: 'propose', change: change.name, status: 'proposed', messages };
}

// ─── apply ───────────────────────────────────────────────────────────────────

export async function runApply(name: string | undefined, cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const changeName = await resolveSingleChange(root, name);
  const change = await readChange(root, changeName);

  const tasksContent = await readArtifact(root, change.name, 'tasks');
  if (tasksContent === null) {
    throw new Error(
      `The change "${change.name}" has no tasks.md. Run "propose ${change.name}" first.`
    );
  }

  const tasks = parseTasks(tasksContent);
  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  await setChangeStatus(root, change.name, 'applying');

  const messages = [
    `Applying the change "${change.name}".`,
    `Tasks: ${done.length} completed, ${pending.length} pending.`,
    ...pending.map((t) => `  [ ] ${t.text}`),
    'Implement the tasks in order, keeping alignment with design.md and specs/.',
  ];
  return { action: 'apply', change: change.name, status: 'applying', messages };
}

// ─── verify ──────────────────────────────────────────────────────────────────

export async function runVerify(name: string | undefined, cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const changeName = await resolveSingleChange(root, name);
  const change = await readChange(root, changeName);

  const states = artifactStates(root, change.name);
  const missing = states.filter((s) => !s.exists);

  const tasksContent = await readArtifact(root, change.name, 'tasks');
  const tasks = tasksContent ? parseTasks(tasksContent) : [];
  const pending = tasks.filter((t) => !t.done);

  const messages: string[] = [];
  messages.push(`Verifying the change "${change.name}".`);
  if (missing.length > 0) {
    messages.push(`Missing artifacts: ${missing.map((m) => m.file).join(', ')}`);
  } else {
    messages.push('All artifacts present (proposal, design, tasks).');
  }
  if (pending.length > 0) {
    messages.push(`Pending tasks: ${pending.length}.`);
  } else if (tasks.length > 0) {
    messages.push('All tasks marked as completed.');
  }

  const ok = missing.length === 0 && pending.length === 0 && tasks.length > 0;
  if (ok) {
    await setChangeStatus(root, change.name, 'verified');
    messages.push('Status updated to "verified".');
  } else {
    messages.push('Not ready to archive yet; resolve the points above.');
  }

  return { action: 'verify', change: change.name, status: ok ? 'verified' : change.metadata.status, messages };
}

// ─── archive ─────────────────────────────────────────────────────────────────

// ─── merge (early-sync) ────────────────────────────────────────────────────

/**
 * Applies a change's spec deltas into the project's consolidated specs WITHOUT
 * archiving the change. This is the "early-sync": it keeps
 * `agentic-fy/specs/<capability>.md` current while the change is still in
 * progress, so the consolidated specs (and the context an AI agent reads)
 * reflect the latest requirements before the change is archived.
 *
 * The merge is idempotent, so running it repeatedly is safe. Use `dryRun` to
 * preview the result without writing anything.
 */
export async function runMerge(
  name: string | undefined,
  cwd = process.cwd(),
  options: { dryRun?: boolean } = {}
): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const changeName = await resolveSingleChange(root, name);

  const specResult = await applyChangeSpecs(root, changeName, { dryRun: options.dryRun });
  const messages: string[] = [];

  if (specResult.empty) {
    messages.push('No spec deltas to merge.');
    return { action: 'merge', change: changeName, messages };
  }

  for (const cap of specResult.applied) {
    const verb = cap.created ? 'created' : 'updated';
    messages.push(
      `Spec "${cap.capability}" ${verb}: ` +
        `+${cap.counts.added} ~${cap.counts.modified} -${cap.counts.removed}`
    );
    for (const w of cap.warnings) messages.push(`  warning: ${w}`);
  }

  if (options.dryRun) {
    messages.unshift(`Dry run for "${changeName}" (nothing written).`);
  } else {
    messages.push(`Merged "${changeName}" into the project specs (change kept active).`);
  }

  return { action: 'merge', change: changeName, messages };
}

export async function runArchive(
  name: string | undefined,
  cwd = process.cwd(),
  options: { dryRun?: boolean } = {}
): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const changeName = await resolveSingleChange(root, name);

  // 1. Merge the change's spec deltas into the project's consolidated specs.
  const specResult = await applyChangeSpecs(root, changeName, { dryRun: options.dryRun });
  const messages: string[] = [];

  if (specResult.empty) {
    messages.push('No spec deltas to apply.');
  } else {
    for (const cap of specResult.applied) {
      const verb = cap.created ? 'created' : 'updated';
      messages.push(
        `Spec "${cap.capability}" ${verb}: ` +
          `+${cap.counts.added} ~${cap.counts.modified} -${cap.counts.removed}`
      );
      for (const w of cap.warnings) messages.push(`  warning: ${w}`);
    }
  }

  // 2. In dry-run, stop before touching the change on disk.
  if (options.dryRun) {
    messages.unshift(`Dry run for "${changeName}" (nothing written).`);
    return { action: 'archive', change: changeName, status: 'proposed', messages };
  }

  // 3. Move the change into the archive.
  const dest = await archiveChange(root, changeName);
  messages.push(`Change "${changeName}" archived at ${dest}.`);

  return { action: 'archive', change: changeName, status: 'archived', messages };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves the change name: uses the provided one, or the only active change if
 * there is exactly one. Otherwise, guides the user to specify it.
 */
async function resolveSingleChange(root: string, name?: string): Promise<string> {
  if (name) {
    // readChange/archiveChange do the final validation of the name.
    return name;
  }
  const list = await listChanges(root);
  if (list.length === 1) {
    return list[0].name;
  }
  if (list.length === 0) {
    throw new Error('No active changes. Run "propose <name>" first.');
  }
  throw new Error(
    `There are multiple active changes (${list.map((c) => c.name).join(', ')}). ` +
      `Specify the name: use "<command> <name>".`
  );
}
