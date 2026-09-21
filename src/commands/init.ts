import type { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';

import { initProject } from '../core/init.js';
import { selectTools } from '../core/tool-selection.js';
import { ALL_TOOL_IDS } from '../core/tools.js';

/**
 * Registra o comando `init`, que cria a estrutura base do projeto
 * (diretórios + agentic.config.yaml) e, opcionalmente, configura a integração
 * MCP das ferramentas de IA escolhidas.
 */
export function registerInitCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('init [path]')
    .description('Cria a estrutura base do projeto agentic e integra as ferramentas de IA')
    .option(
      '--tools <lista>',
      `Ferramentas a configurar sem prompt: all | none | ${ALL_TOOL_IDS.join(',')}`
    )
    .action(async (targetPath = '.', options: { tools?: string }) => {
      try {
        // 1. Seleciona as ferramentas (flag > prompt interativo > nenhuma).
        const tools = await selectTools(path.resolve(targetPath), { toolsFlag: options.tools });

        // 2. Cria a estrutura e configura as ferramentas escolhidas.
        const result = await initProject(targetPath, tools);
        const rel = (p: string) => path.relative(result.root, p) || '.';

        console.log(chalk.bold('Projeto agentic inicializado'));
        console.log(`Raiz: ${result.root}`);
        if (result.createdDirs.length > 0) {
          console.log('Diretórios criados:');
          for (const dir of result.createdDirs) {
            console.log(`  ${rel(dir)}`);
          }
        } else {
          console.log(chalk.dim('Estrutura já existia (nada novo a criar).'));
        }
        console.log(
          result.configStatus === 'created'
            ? 'Config: agentic.config.yaml (criado)'
            : chalk.dim('Config: agentic.config.yaml (já existia)')
        );

        // 3. Reporta a integração de cada ferramenta.
        if (result.tools.length > 0) {
          console.log('Ferramentas (MCP):');
          for (const t of result.tools) {
            const label =
              t.outcome === 'created'
                ? chalk.green('configurada')
                : t.outcome === 'updated'
                  ? chalk.green('atualizada')
                  : chalk.dim('sem alteração');
            console.log(`  ${t.tool.name}: ${label} — ${rel(t.file)}`);
          }
        } else {
          console.log(
            chalk.dim(
              'Nenhuma ferramenta configurada. Use "agentic init --tools kiro,cursor" para integrar.'
            )
          );
        }

        console.log();
        console.log(chalk.dim('Próximo passo: agentic propose "sua ideia"'));
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
