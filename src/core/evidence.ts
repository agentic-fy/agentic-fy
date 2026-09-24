import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import { changeDir, SPECS_DIR, listChanges } from './change.js';
import { parseSpecDelta, SpecDelta } from './spec-delta.js';
import { mergeDelta } from './spec-merge.js';
import { CapabilitySpec, Requirement, emptySpec } from './spec-model.js';

/**
 * Evidence collection.
 *
 * Evidence is COMMAND-ONLY by design. A requirement proves itself by a shell
 * command that exits 0 — there is no self-declared "manual" evidence, so an
 * agent cannot approve a requirement without an executable proof. A requirement
 * with no command is an honest, visible gap (not "verified").
 *
 * Evidence is collected per requirement declared by a change's spec deltas
 * (`specs/*.delta.yaml`): the requirements that change is responsible for.
 */

/** Default per-command timeout (ms). */
const DEFAULT_TIMEOUT = 120_000;

export type EvidenceStatus = 'passed' | 'failed' | 'gap';

export interface RequirementEvidence {
  capability: string;
  id: string;
  title: string;
  /** The command run, if the requirement declared one. */
  command?: string;
  status: EvidenceStatus;
  /** Exit code (present for passed/failed). */
  exitCode?: number;
  /** Short reason for a failure (non-zero exit, timeout, spawn error). */
  detail?: string;
}

export interface EvidenceReport {
  change: string;
  requirements: RequirementEvidence[];
  totals: {
    total: number;
    passed: number;
    failed: number;
    gaps: number;
  };
}

/** Aggregated evidence coverage across active changes (for the dashboard). */
export interface EvidenceCoverage {
  total: number;
  passed: number;
  failed: number;
  gaps: number;
}

/** Runs a shell command in `cwd`, resolving with its exit code (or a failure detail). */
function runCommand(
  command: string,
  cwd: string,
  timeout = DEFAULT_TIMEOUT
): Promise<{ code: number | null; detail?: string }> {
  return new Promise((resolve) => {
    // shell:true lets a requirement use a normal command line (pipes, args...).
    const child = spawn(command, { cwd, shell: true, stdio: 'ignore' });
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ code: null, detail: `timed out after ${Math.round(timeout / 1000)}s` });
    }, timeout);

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, detail: err.message });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code });
    });
  });
}

/** Reads and parses all delta files of a change. */
async function readChangeDeltas(root: string, changeName: string): Promise<SpecDelta[]> {
  const dir = path.join(changeDir(root, changeName), SPECS_DIR);
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.delta.yaml'))
    .map((e) => e.name)
    .sort();

  const deltas: SpecDelta[] = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(dir, file), 'utf8');
    deltas.push(parseSpecDelta(content, file)); // throws on invalid — caller handles
  }
  return deltas;
}

/**
 * Consolidates a change's deltas into the final set of requirements per
 * capability. Multiple deltas (or a later `modify`) touching the same id
 * collapse into one requirement, so each requirement is evaluated exactly once.
 * The base is empty on purpose: we evaluate what the CHANGE declares, not the
 * whole project spec.
 */
function consolidateRequirements(
  deltas: SpecDelta[]
): Array<{ capability: string; req: Requirement }> {
  const byCapability = new Map<string, CapabilitySpec>();
  for (const delta of deltas) {
    const base = byCapability.get(delta.capability) ?? emptySpec(delta.capability);
    const result = mergeDelta(base, delta);
    byCapability.set(delta.capability, result.spec);
  }
  const out: Array<{ capability: string; req: Requirement }> = [];
  for (const spec of byCapability.values()) {
    for (const req of spec.requirements) {
      out.push({ capability: spec.capability, req });
    }
  }
  return out;
}

/**
 * Collects evidence for a change: consolidates its deltas into the final
 * requirements, then runs each requirement's `verify` command once and reports
 * per-requirement status.
 *
 * With `dryRun`, it does not run anything — it only reports which requirements
 * have a command versus a gap (useful to preview coverage safely).
 */
export async function collectEvidence(
  root: string,
  changeName: string,
  options: { dryRun?: boolean; timeout?: number } = {}
): Promise<EvidenceReport> {
  const deltas = await readChangeDeltas(root, changeName);
  const finalReqs = consolidateRequirements(deltas);
  const requirements: RequirementEvidence[] = [];

  for (const { capability, req } of finalReqs) {
    const command = req.verify;

    if (!command) {
      requirements.push({ capability, id: req.id, title: req.title, status: 'gap' });
      continue;
    }

    if (options.dryRun) {
      requirements.push({
        capability,
        id: req.id,
        title: req.title,
        command,
        status: 'passed', // not actually run; treated as "would run"
        detail: 'not run (dry run)',
      });
      continue;
    }

    const { code, detail } = await runCommand(command, root, options.timeout);
    requirements.push({
      capability,
      id: req.id,
      title: req.title,
      command,
      status: code === 0 ? 'passed' : 'failed',
      ...(code != null ? { exitCode: code } : {}),
      ...(detail ? { detail } : code !== 0 ? { detail: `exit ${code}` } : {}),
    });
  }

  const totals = {
    total: requirements.length,
    passed: requirements.filter((r) => r.status === 'passed').length,
    failed: requirements.filter((r) => r.status === 'failed').length,
    gaps: requirements.filter((r) => r.status === 'gap').length,
  };

  return { change: changeName, requirements, totals };
}

/**
 * Aggregates evidence coverage across all active changes, WITHOUT running any
 * command (dashboard-safe): it only counts which requirements have a command
 * versus a gap. Running commands is reserved for the explicit `verify` flow.
 */
export async function evidenceCoverage(root: string): Promise<EvidenceCoverage> {
  const coverage: EvidenceCoverage = { total: 0, passed: 0, failed: 0, gaps: 0 };
  const changes = await listChanges(root);
  for (const change of changes) {
    let report: EvidenceReport;
    try {
      report = await collectEvidence(root, change.name, { dryRun: true });
    } catch {
      // An invalid delta shouldn't crash the dashboard; skip that change.
      continue;
    }
    coverage.total += report.totals.total;
    // In dry-run, "passed" means "has a command"; the rest are gaps.
    coverage.passed += report.requirements.filter((r) => r.command).length;
    coverage.gaps += report.requirements.filter((r) => !r.command).length;
  }
  return coverage;
}
