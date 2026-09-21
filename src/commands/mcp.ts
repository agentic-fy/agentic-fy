import type { Command } from 'commander';

/**
 * Registra o comando `mcp`, que sobe o servidor MCP via stdio expondo os
 * comandos de workflow como tools. O SDK é importado de forma lazy para não
 * penalizar o startup dos comandos comuns.
 */
export function registerMcpCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('mcp')
    .description('Inicia o servidor MCP (stdio) expondo as tools de workflow')
    .action(async () => {
      try {
        const { startMcpServer } = await import('../mcp/server.js');
        await startMcpServer();
        // startMcpServer resolve quando conecta; o processo segue vivo
        // enquanto o transporte stdio estiver aberto.
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
