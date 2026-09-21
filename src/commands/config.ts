import type { Command } from 'commander';
import { promises as fs } from 'fs';
import chalk from 'chalk';

import {
  requireProjectRoot,
  readProjectConfig,
  serializeProjectConfig,
  resolveProjectPaths,
} from '../core/change.js';
import { ProjectConfigSchema, ProjectConfig } from '../core/schema.js';

/**
 * Comando `config`: mostrar e editar o agentic.config.yaml.
 *
 * Reescreve, enxuto, a ideia do `config` do projeto de referência (/base):
 * ler/alterar a configuração do projeto pela CLI, sem store nem profiles.
 * Toda escrita passa pelo schema (zod), então nunca gravamos config inválido.
 */

/** Campos escalares editáveis via `config set`. */
const SETTABLE = ['version', 'schema'] as const;

export function registerConfigCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  const config = program.command('config').description('Mostra ou edita o agentic.config.yaml');

  config
    .command('show')
    .description('Mostra a configuração atual do projeto')
    .option('--json', 'Saída em JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const root = requireProjectRoot();
        const cfg = await readProjectConfig(root);
        if (options.json) {
          console.log(JSON.stringify(cfg, null, 2));
        } else {
          console.log(chalk.bold('agentic.config.yaml'));
          console.log(`  version:  ${cfg.version}`);
          console.log(`  schema:   ${cfg.schema}`);
          console.log(`  workflow: ${cfg.workflow.join(' → ')}`);
        }
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });

  config
    .command('set <chave> <valor>')
    .description(`Define um valor de config. Chaves: ${SETTABLE.join(', ')}`)
    .action(async (chave: string, valor: string) => {
      try {
        const root = requireProjectRoot();
        const cfg = await readProjectConfig(root);

        const key = chave.trim().toLowerCase();
        if (!SETTABLE.includes(key as (typeof SETTABLE)[number])) {
          throw new Error(
            `Chave não editável: "${chave}". Editáveis: ${SETTABLE.join(', ')}.`
          );
        }

        const next: ProjectConfig = { ...cfg };
        if (key === 'version') {
          const n = Number.parseInt(valor, 10);
          if (!Number.isInteger(n) || n <= 0) {
            throw new Error(`version deve ser um inteiro positivo (recebido: "${valor}").`);
          }
          next.version = n;
        } else if (key === 'schema') {
          next.schema = valor.trim();
        }

        // Valida antes de gravar; nunca escreve config inválido.
        const validated = ProjectConfigSchema.parse(next);
        const { configFile } = resolveProjectPaths(root);
        await fs.writeFile(configFile, serializeProjectConfig(validated), 'utf8');

        console.log(chalk.green(`config atualizado: ${key} = ${valor}`));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
