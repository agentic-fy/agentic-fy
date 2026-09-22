import { promises as fs, existsSync } from 'fs';

import {
  resolveProjectPaths,
  readProjectConfig,
  listChanges,
  changeExists,
  ARCHIVE_DIR,
  METADATA_FILE,
  type Change,
} from './change.js';
import { validateChange } from './validate.js';

/**
 * `doctor`: project integrity check.
 *
 * A lean rewrite of the `doctor` idea from the reference project (/base) —
 * there coupled to store/roots — for agentic-fy's single-repo model. It answers
 * "is the project consistent?": valid config, intact change metadata, nothing
 * orphaned, and consistent artifacts. Read-only; it does not repair anything.
 */

export type CheckLevel = 'ERROR' | 'WARNING' | 'INFO';

export interface DoctorFinding {
  level: CheckLevel;
  scope: string; // 'config' | 'changes' | '<change-name>'
  message: string;
}

export interface DoctorReport {
  healthy: boolean;
  findings: DoctorFinding[];
}

export async function runDoctor(root: string): Promise<DoctorReport> {
  const findings: DoctorFinding[] = [];
  const paths = resolveProjectPaths(root);

  // 1. Config: does it exist and parse against the schema?
  if (!existsSync(paths.configFile)) {
    findings.push({
      level: 'ERROR',
      scope: 'config',
      message: `agentic-fy.config.yaml missing in ${root}.`,
    });
  } else {
    try {
      await readProjectConfig(root); // validates via ProjectConfigSchema
    } catch (error) {
      findings.push({
        level: 'ERROR',
        scope: 'config',
        message: `Invalid agentic-fy.config.yaml: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  // 2. Orphaned change directories: a folder in changes/ without valid metadata.
  if (existsSync(paths.changesDir)) {
    const entries = await fs.readdir(paths.changesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ARCHIVE_DIR) continue;
      if (!changeExists(root, entry.name)) {
        findings.push({
          level: 'WARNING',
          scope: entry.name,
          message: `Directory in changes/ without ${METADATA_FILE} — not a valid change.`,
        });
      }
    }
  }

  // 3. Each active change: readable metadata + consistent artifacts.
  let changes: Change[];
  try {
    changes = await listChanges(root);
  } catch (error) {
    findings.push({
      level: 'ERROR',
      scope: 'changes',
      message: `Failed to read the changes: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    changes = [];
  }

  for (const change of changes) {
    try {
      const report = await validateChange(root, change.name);
      for (const issue of report.issues) {
        // Only structural errors go into doctor; content-fill warnings belong
        // to `validate`. This keeps doctor focused on integrity.
        if (issue.level === 'ERROR') {
          findings.push({
            level: 'ERROR',
            scope: change.name,
            message: `${issue.path}: ${issue.message}`,
          });
        }
      }
    } catch (error) {
      findings.push({
        level: 'ERROR',
        scope: change.name,
        message: `Unreadable change: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const healthy = findings.every((f) => f.level !== 'ERROR');
  return { healthy, findings };
}
