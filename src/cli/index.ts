import { Command } from 'commander';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import { registerInitCommand } from '../commands/init.js';
import { registerWorkflowCommands } from '../commands/workflow.js';
import { registerInspectCommands } from '../commands/inspect.js';
import { registerConfigCommand } from '../commands/config.js';
import { registerCompletionCommand } from '../commands/completion.js';
import { registerViewCommand } from '../commands/view.js';
import { registerMcpCommand } from '../commands/mcp.js';
import { renderVersion } from '../ui/version.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

/**
 * Reporta um erro de forma consistente e define o exit code.
 * Espelha o padrão `failWithError` do projeto de referência (/base),
 * porém enxuto: sem telemetria nem payloads JSON por comando.
 */
export function failWithError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`Erro: ${message}`));
  process.exitCode = process.exitCode ?? 1;
}

const program = new Command();

program
  .name('agentic')
  .description('CLI spec-driven enxuto, performático e com suporte a MCP')
  // Flag de versão como opção comum: o output customizado (logo + versão +
  // comandos) é tratado em `printVersion`, não pelo handler embutido do commander.
  .option('-v, --version', 'Mostra a versão, o logo e os comandos disponíveis')
  .option('--no-color', 'Desabilita saída colorida');

program.hook('preAction', (thisCommand) => {
  if (thisCommand.opts().color === false) {
    process.env.NO_COLOR = '1';
  }
});

// Registro dos comandos (setup + workflow + inspeção + mcp)
registerInitCommand(program, failWithError);
registerWorkflowCommands(program, failWithError);
registerInspectCommands(program, failWithError);
registerConfigCommand(program, failWithError);
registerCompletionCommand(program, failWithError);
registerViewCommand(program, failWithError);
registerMcpCommand(program, failWithError);

export { program };

/** Imprime logo + versão + todos os comandos disponíveis. */
export function printVersion(): void {
  if (program.opts().color === false) {
    process.env.NO_COLOR = '1';
  }
  console.log(renderVersion(program, version));
}

export function runCli(argv = process.argv): void {
  // Intercepta -v/--version antes do parse dos subcomandos para exibir a
  // tela customizada (o commander só imprimiria a string da versão).
  const args = argv.slice(2);
  if (args.includes('-v') || args.includes('--version')) {
    printVersion();
    return;
  }

  program.parseAsync(argv).catch((error) => {
    failWithError(error);
    process.exit(process.exitCode ?? 1);
  });
}

// Permite `node dist/cli/index.js` diretamente durante o desenvolvimento.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
