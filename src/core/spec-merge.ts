import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { resolveProjectPaths, changeDir, SPECS_DIR } from './change.js';
import {
  CapabilitySpec,
  Requirement,
  emptySpec,
  parseSpec,
  renderSpec,
} from './spec-model.js';
import { SpecDelta, SpecOperation, parseSpecDelta } from './spec-delta.js';

/**
 * Spec merge engine.
 *
 * Applies a structured YAML delta onto a consolidated capability spec. The
 * merge is:
 *  - deterministic: operations run in the order remove -> modify -> add;
 *  - idempotent: re-applying the same delta produces the same spec (an add that
 *    matches an existing identical requirement is a no-op; a remove of a missing
 *    id is a no-op with a warning);
 *  - fail-loud: a modify of a missing id, or an add that collides with a
 *    different requirement, throws with the offending id.
 */

export interface MergeCounts {
  added: number;
  modified: number;
  removed: number;
}

export interface MergeResult {
  spec: CapabilitySpec;
  counts: MergeCounts;
  warnings: string[];
  /** True when the capability spec did not exist before this merge. */
  created: boolean;
}

/** Deep-equality for a requirement, ignoring incidental whitespace. */
function sameRequirement(a: Requirement, b: Requirement): boolean {
  return JSON.stringify(normalizeReq(a)) === JSON.stringify(normalizeReq(b));
}

function normalizeReq(r: Requirement): Requirement {
  return {
    id: r.id,
    title: r.title.trim(),
    statement: r.statement.trim(),
    scenarios: r.scenarios.map((s) => ({ when: s.when.trim(), then: s.then.trim() })),
  };
}

/**
 * Applies a delta to a base spec, returning a new spec (base is not mutated).
 * `created` says whether the base was a fresh (nonexistent) spec.
 */
export function mergeDelta(
  base: CapabilitySpec | null,
  delta: SpecDelta
): MergeResult {
  const created = base === null;
  const spec: CapabilitySpec = base
    ? { ...base, requirements: base.requirements.map((r) => ({ ...r, scenarios: [...r.scenarios] })) }
    : emptySpec(delta.capability);

  // Seed purpose only for a brand-new capability; never overwrite an existing one.
  if (created && delta.purpose && !spec.purpose) {
    spec.purpose = delta.purpose.trim();
  }

  const byId = new Map<string, Requirement>();
  spec.requirements.forEach((r) => byId.set(r.id, r));

  const counts: MergeCounts = { added: 0, modified: 0, removed: 0 };
  const warnings: string[] = [];

  const removes = delta.operations.filter((o): o is Extract<SpecOperation, { op: 'remove' }> => o.op === 'remove');
  const modifies = delta.operations.filter((o): o is Extract<SpecOperation, { op: 'modify' }> => o.op === 'modify');
  const adds = delta.operations.filter((o): o is Extract<SpecOperation, { op: 'add' }> => o.op === 'add');

  // remove
  for (const op of removes) {
    if (!byId.has(op.id)) {
      warnings.push(`remove: requirement "${op.id}" not found; treating as already removed.`);
      continue;
    }
    byId.delete(op.id);
    counts.removed += 1;
  }

  // modify
  for (const op of modifies) {
    const req = byId.get(op.id);
    if (!req) {
      throw new Error(
        `modify: requirement "${op.id}" not found in capability "${spec.capability}".`
      );
    }
    if (op.set?.title) req.title = op.set.title;
    if (op.set?.statement) req.statement = op.set.statement;
    if (op.removeScenarios?.length) {
      req.scenarios = req.scenarios.filter(
        (s) => !op.removeScenarios!.some((w) => w.trim() === s.when.trim())
      );
    }
    if (op.addScenarios?.length) {
      for (const sc of op.addScenarios) {
        const exists = req.scenarios.some(
          (s) => s.when.trim() === sc.when.trim() && s.then.trim() === sc.then.trim()
        );
        if (!exists) req.scenarios.push({ when: sc.when, then: sc.then });
      }
    }
    counts.modified += 1;
  }

  // add
  for (const op of adds) {
    const incoming: Requirement = {
      id: op.id,
      title: op.title,
      statement: op.statement,
      scenarios: op.scenarios ?? [],
    };
    const existing = byId.get(op.id);
    if (existing) {
      if (sameRequirement(existing, incoming)) {
        // Idempotent re-apply: no-op.
        continue;
      }
      throw new Error(
        `add: requirement "${op.id}" already exists in capability "${spec.capability}" with different content. Use "modify" to change it.`
      );
    }
    byId.set(op.id, incoming);
    spec.requirements.push(incoming);
    counts.added += 1;
  }

  // Drop removed requirements from the ordered list (map is the source of truth).
  spec.requirements = spec.requirements.filter((r) => byId.has(r.id));

  return { spec, counts, warnings, created };
}

// ─── Change integration ────────────────────────────────────────────────────

export interface AppliedCapability {
  capability: string;
  created: boolean;
  counts: MergeCounts;
  warnings: string[];
  /** Absolute path of the consolidated spec that was (or would be) written. */
  target: string;
}

export interface ApplyResult {
  applied: AppliedCapability[];
  /** True when nothing was applied because the change has no delta files. */
  empty: boolean;
}

/** Finds `*.delta.yaml` files inside a change's specs/ directory. */
async function findDeltaFiles(root: string, changeName: string): Promise<string[]> {
  const dir = path.join(changeDir(root, changeName), SPECS_DIR);
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.delta.yaml'))
    .map((e) => path.join(dir, e.name))
    .sort();
}

/**
 * Applies every delta of a change to the project's consolidated specs.
 *
 * With `dryRun`, computes and returns the merge results without writing
 * anything. Otherwise writes each `agentic-fy/specs/<capability>.md`.
 */
export async function applyChangeSpecs(
  root: string,
  changeName: string,
  options: { dryRun?: boolean } = {}
): Promise<ApplyResult> {
  const { specsDir } = resolveProjectPaths(root);
  const deltaFiles = await findDeltaFiles(root, changeName);
  if (deltaFiles.length === 0) {
    return { applied: [], empty: true };
  }

  const applied: AppliedCapability[] = [];

  for (const file of deltaFiles) {
    const content = await fs.readFile(file, 'utf8');
    const delta = parseSpecDelta(content, path.basename(file));

    // Capability file lives at specs/<capability>.md (slashes -> nested dirs).
    const target = path.join(specsDir, ...delta.capability.split('/')) + '.md';

    let base: CapabilitySpec | null = null;
    if (existsSync(target)) {
      base = parseSpec(await fs.readFile(target, 'utf8'), delta.capability);
    }

    const result = mergeDelta(base, delta);

    if (!options.dryRun) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, renderSpec(result.spec), 'utf8');
    }

    applied.push({
      capability: delta.capability,
      created: result.created,
      counts: result.counts,
      warnings: result.warnings,
      target,
    });
  }

  return { applied, empty: false };
}
