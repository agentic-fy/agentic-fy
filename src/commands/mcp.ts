import type { Command } from 'commander';

/**
 * Registers the `mcp` command, which starts the MCP server over stdio exposing
 * the workflow commands as tools. The SDK is imported lazily so as not to
 * penalize the startup of the common commands.
 */
export function registerMcpCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('mcp')
    .description('Starts the MCP server (stdio) exposing the workflow tools')
    .action(async () => {
      try {
        const { startMcpServer } = await import('../mcp/server.js');
        await startMcpServer();
        // startMcpServer resolves once connected; the process stays alive
        // while the stdio transport is open.
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
