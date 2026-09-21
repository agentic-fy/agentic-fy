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
 * `doctor`: checagem de integridade do projeto.
 *
 * Reescreve, enxuto, a ideia do `doctor` do projeto de referência (/base) —
 * lá acoplado a store/roots — para o modelo single-repo do agentic. Responde
 * "o projeto está consistente?": config válido, metadata das changes íntegro,
 * nada órfão e artefatos coerentes. Somente leitura; não repara nada.
 */

export type CheckLevel = 'ERROR' | 'WARNING' | 'INFO';

export interface DoctorFinding {
  level: CheckLevel;
  scope: string; // 'config' | 'changes' | '<nome-da-change>'
  message: string;
}

export interface DoctorReport {
  healthy: boolean;
  findings: DoctorFinding[];
}

export async function runDoctor(root: string): Promise<DoctorReport> {
  const findings: DoctorFinding[] = [];
  const paths = resolveProjectPaths(root);

  // 1. Config: existe e faz o parse pelo schema?
  if (!existsSync(paths.configFile)) {
    findings.push({
      level: 'ERROR',
      scope: 'config',
      message: `agentic.config.yaml ausente em ${root}.`,
    });
  } else {
    try {
      await readProjectConfig(root); // valida via ProjectConfigSchema
    } catch (error) {
      findings.push({
        level: 'ERROR',
        scope: 'config',
        message: `agentic.config.yaml inválido: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  // 2. Diretórios de change órfãos: pasta em changes/ sem metadata válido.
  if (existsSync(paths.changesDir)) {
    const entries = await fs.readdir(paths.changesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ARCHIVE_DIR) continue;
      if (!changeExists(root, entry.name)) {
        findings.push({
          level: 'WARNING',
          scope: entry.name,
          message: `Diretório em changes/ sem ${METADATA_FILE} — não é uma change válida.`,
        });
      }
    }
  }

  // 3. Cada change ativa: metadata legível + artefatos coerentes.
  let changes: Change[];
  try {
    changes = await listChanges(root);
  } catch (error) {
    findings.push({
      level: 'ERROR',
      scope: 'changes',
      message: `Falha ao ler as changes: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    changes = [];
  }

  for (const change of changes) {
    try {
      const report = await validateChange(root, change.name);
      for (const issue of report.issues) {
        // Só erros de estrutura entram no doctor; avisos de preenchimento são
        // do `validate`. Isso mantém o doctor focado em integridade.
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
        message: `Change ilegível: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const healthy = findings.every((f) => f.level !== 'ERROR');
  return { healthy, findings };
}
