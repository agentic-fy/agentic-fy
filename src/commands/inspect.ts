import type { Command } from 'commander';
import chalk from 'chalk';

import { requireProjectRoot, listChanges } from '../core/change.js';
import {
  listChangeSummaries,
  listSpecIds,
  showChange,
  readChangeArtifact,
  readSpec,
} from '../core/inspect.js';
import { validateChange } from '../core/validate.js';
import { projectStatus } from '../core/status.js';
import { runDoctor } from '../core/doctor.js';
import { projectContext, renderContext } from '../core/context.js';
import { nearestMatches } from '../core/match.js';
import { CHANGE_ARTIFACTS, ChangeArtifact } from '../core/schema.js';

/**
 * Comandos de inspeção: list, show, validate.
 *
 * Reescrita enxuta das funcionalidades equivalentes do projeto de referência
 * (/base). Cada handler delega às funções puras do core e formata a saída.
 * Suportam `--json` onde faz sentido, sem prompts interativos.
 */

// ─── helpers ───────────────────────────────────────────────────────────────────

/** Resolve o nome de uma change existente ou lança com sugestão "did you mean". */
async function resolveChangeName(root: string, name: string): Promise<string> {
  const changes = await listChanges(root);
  const names = changes.map((c) => c.name);
  if (names.includes(name)) return name;

  const suggestions = nearestMatches(name, names);
  const hint = suggestions.length
    ? ` Você quis dizer: ${suggestions.join(', ')}?`
    : names.length
      ? ` Ativas: ${names.join(', ')}.`
      : '';
  throw new Error(`Change "${name}" não encontrada.${hint}`);
}

function levelPrefix(level: 'ERROR' | 'WARNING' | 'INFO'): string {
  return level === 'ERROR' ? '✗' : level === 'WARNING' ? '⚠' : 'ℹ';
}

// ─── register ──────────────────────────────────────────────────────────────────

export function registerInspectCommands(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  // ─── list ────────────────────────────────────────────────────────────────
  program
    .command('list')
    .description('Lista as changes ativas (e specs com --specs)')
    .option('--specs', 'Lista as specs do projeto em vez das changes')
    .option('--long', 'Mostra título e progresso de tarefas')
    .option('--json', 'Saída em JSON')
    .action(async (options: { specs?: boolean; long?: boolean; json?: boolean }) => {
      try {
        const root = requireProjectRoot();

        if (options.specs) {
          const specs = await listSpecIds(root);
          if (options.json) {
            console.log(JSON.stringify(specs, null, 2));
          } else if (specs.length === 0) {
            console.log('Nenhuma spec encontrada.');
          } else {
            specs.forEach((id) => console.log(id));
          }
          return;
        }

        const summaries = await listChangeSummaries(root);
        if (options.json) {
          console.log(JSON.stringify(summaries, null, 2));
          return;
        }
        if (summaries.length === 0) {
          console.log('Nenhuma change ativa. Rode "agentic propose <nome>".');
          return;
        }
        for (const s of summaries) {
          if (!options.long) {
            console.log(s.name);
            continue;
          }
          const tasks = s.tasks.total > 0 ? ` [tarefas ${s.tasks.completed}/${s.tasks.total}]` : '';
          console.log(
            `${chalk.bold(s.name)} ${chalk.dim(`(${s.status})`)}: ${s.title}${chalk.dim(tasks)}`
          );
        }
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  // ─── show ────────────────────────────────────────────────────────────────
  program
    .command('show <nome>')
    .description('Mostra uma change (ou um artefato/spec específico)')
    .option('--artifact <id>', `Mostra um artefato: ${CHANGE_ARTIFACTS.join(' | ')}`)
    .option('--spec <id>', 'Mostra o conteúdo de uma spec do projeto (agentic/specs/<id>.md)')
    .option('--json', 'Saída em JSON (resumo estruturado da change)')
    .action(
      async (
        nome: string,
        options: { artifact?: string; spec?: string; json?: boolean }
      ) => {
        try {
          const root = requireProjectRoot();

          // Mostrar uma spec do projeto (independe de change).
          if (options.spec) {
            console.log(await readSpec(root, options.spec));
            return;
          }

          const changeName = await resolveChangeName(root, nome);

          // Mostrar um artefato cru.
          if (options.artifact) {
            const id = options.artifact.toLowerCase();
            if (!CHANGE_ARTIFACTS.includes(id as ChangeArtifact)) {
              throw new Error(
                `Artefato inválido: "${options.artifact}". Use: ${CHANGE_ARTIFACTS.join(', ')}.`
              );
            }
            console.log(await readChangeArtifact(root, changeName, id as ChangeArtifact));
            return;
          }

          const detail = await showChange(root, changeName);
          if (options.json) {
            console.log(JSON.stringify(detail, null, 2));
            return;
          }

          console.log(chalk.bold(`${detail.name}`) + chalk.dim(` (${detail.status})`));
          console.log(`Título: ${detail.title}`);
          console.log(
            `Tarefas: ${detail.tasks.completed}/${detail.tasks.total} concluídas`
          );
          console.log('Artefatos:');
          for (const a of detail.artifacts) {
            const mark = a.exists ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${mark} ${a.file}`);
          }
          if (detail.specs.length > 0) {
            console.log(`Specs da change: ${detail.specs.join(', ')}`);
          }
        } catch (error) {
          failWithError(error);
          process.exit(1);
        }
      }
    );

  // ─── validate ──────────────────────────────────────────────────────────────
  program
    .command('validate [nome]')
    .description('Valida os artefatos de uma change (ou de todas com --all)')
    .option('--all', 'Valida todas as changes ativas')
    .option('--strict', 'Trata avisos (WARNING) como falha')
    .option('--json', 'Saída em JSON')
    .action(
      async (
        nome: string | undefined,
        options: { all?: boolean; strict?: boolean; json?: boolean }
      ) => {
        try {
          const root = requireProjectRoot();

          let targets: string[];
          if (options.all) {
            targets = (await listChanges(root)).map((c) => c.name).sort();
          } else if (nome) {
            targets = [await resolveChangeName(root, nome)];
          } else {
            const active = await listChanges(root);
            if (active.length === 1) {
              targets = [active[0].name];
            } else if (active.length === 0) {
              throw new Error('Nenhuma change ativa. Rode "agentic propose <nome>".');
            } else {
              throw new Error(
                `Há várias changes ativas (${active
                  .map((c) => c.name)
                  .join(', ')}). Informe o nome ou use --all.`
              );
            }
          }

          const reports = await Promise.all(
            targets.map((t) => validateChange(root, t, options.strict))
          );

          if (options.json) {
            console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
          } else {
            for (const report of reports) {
              const head = report.valid
                ? chalk.green(`✓ ${report.change} — válida`)
                : chalk.red(`✗ ${report.change} — com problemas`);
              console.log(head);
              for (const issue of report.issues) {
                const line = `  ${levelPrefix(issue.level)} [${issue.level}] ${issue.path}: ${issue.message}`;
                if (issue.level === 'ERROR') console.error(line);
                else console.log(line);
              }
            }
          }

          const anyInvalid = reports.some((r) => !r.valid);
          if (anyInvalid) process.exitCode = 1;
        } catch (error) {
          failWithError(error);
          process.exit(1);
        }
      }
    );

  // ─── status ──────────────────────────────────────────────────────────────
  program
    .command('status')
    .description('Panorama das changes ativas: estágio, progresso e problemas')
    .option('--json', 'Saída em JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const status = await projectStatus(root);
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }
        if (status.total === 0) {
          console.log('Nenhuma change ativa. Rode "agentic propose <nome>".');
          return;
        }
        const byStatus = Object.entries(status.byStatus)
          .map(([s, n]) => `${s}: ${n}`)
          .join(', ');
        console.log(chalk.bold(`Changes ativas: ${status.total}`) + chalk.dim(` (${byStatus})`));
        for (const c of status.changes) {
          const tasks = `tarefas ${c.tasks.completed}/${c.tasks.total}`;
          const problems =
            c.errors > 0
              ? chalk.red(` ${c.errors} erro(s)`)
              : c.warnings > 0
                ? chalk.yellow(` ${c.warnings} aviso(s)`)
                : chalk.green(' ok');
          console.log(
            `  ${chalk.bold(c.name)} ${chalk.dim(`(${c.status})`)} — ${tasks} ·${problems}`
          );
        }
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  // ─── doctor ──────────────────────────────────────────────────────────────
  program
    .command('doctor')
    .description('Verifica a integridade do projeto (config, metadata, artefatos)')
    .option('--json', 'Saída em JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const report = await runDoctor(root);
        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else if (report.findings.length === 0) {
          console.log(chalk.green('✓ Projeto saudável, nenhum problema encontrado.'));
        } else {
          console.log(
            report.healthy
              ? chalk.yellow('Projeto com avisos:')
              : chalk.red('Projeto com problemas:')
          );
          for (const f of report.findings) {
            const line = `  ${levelPrefix(f.level)} [${f.level}] ${f.scope}: ${f.message}`;
            if (f.level === 'ERROR') console.error(line);
            else console.log(line);
          }
        }
        if (!report.healthy) process.exitCode = 1;
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  // ─── context ───────────────────────────────────────────────────────────────
  program
    .command('context')
    .description('Reúne o contexto do projeto (config, changes, specs) para o agente')
    .option('--json', 'Saída em JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const ctx = await projectContext(root);
        console.log(options.json ? JSON.stringify(ctx, null, 2) : renderContext(ctx));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
