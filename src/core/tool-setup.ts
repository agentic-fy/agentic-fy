import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { AiTool, McpFormat } from './tools.js';

/**
 * Per-tool MCP configuration generation/merge.
 *
 * Mirrors the purpose of `generateSkillsAndCommands` from the reference project
 * (/base) — getting the chosen tool ready to use agentic-fy — but adapted to the
 * MCP-first model: it writes (or merges) the IDE's MCP config file pointing to
 * `agentic-fy mcp`.
 *
 * Improvements over /base:
 *  - NON-destructive merge: preserves other servers and the user's keys;
 *  - idempotent: running again does not duplicate or overwrite manual config;
 *  - dependency-free (native JSON).
 */

/** Name of agentic-fy's MCP server inside the config file. */
export const MCP_SERVER_NAME = 'agentic-fy';

export type ToolSetupOutcome = 'created' | 'updated' | 'unchanged';

export interface ToolSetupResult {
  tool: AiTool;
  file: string;
  outcome: ToolSetupOutcome;
}

/** npm package that provides the `agentic-fy mcp` server. */
const MCP_PACKAGE = '@agentic-fy/agentic-fy';

/** The command that starts the MCP server, shared by every format. */
const MCP_ARGV = ['npx', '-y', MCP_PACKAGE, 'mcp'] as const;

/**
 * A builder per MCP entry format. Each returns the server-entry object in the
 * exact shape that format expects. Keyed by `McpFormat`, so adding a new format
 * to the type forces adding its builder here (exhaustive by construction).
 *
 *  - 'standard': `{ command, args, disabled, autoApprove }` (Kiro, Cursor,
 *    Copilot, Claude, Windsurf).
 *  - 'opencode': `{ type: 'local', command: [...], enabled }` (OpenCode).
 */
const ENTRY_BUILDERS: Record<McpFormat, () => Record<string, unknown>> = {
  standard: () => ({
    command: MCP_ARGV[0],
    args: [...MCP_ARGV.slice(1)],
    disabled: false,
    // Read tools can run without confirmation; write ones cannot.
    autoApprove: ['explore', 'list', 'show', 'validate'],
  }),
  opencode: () => ({
    type: 'local',
    command: [...MCP_ARGV],
    enabled: true,
  }),
};

/** The agentic-fy MCP server definition, in the shape the tool expects. */
function agenticServerEntry(format: McpFormat): Record<string, unknown> {
  return ENTRY_BUILDERS[format]();
}

/** Compares two server entries stably (key order). */
function sameEntry(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Writes/merges a tool's MCP config. Does not overwrite other servers or keys
 * already present; it only ensures the `agentic-fy` server exists and is up to date.
 */
export async function setupTool(root: string, tool: AiTool): Promise<ToolSetupResult> {
  const file = path.join(root, tool.mcpConfigPath);

  // Read the existing config (tolerant to a missing file or invalid JSON).
  let config: Record<string, unknown> = {};
  let existed = false;
  if (existsSync(file)) {
    existed = true;
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>;
      }
    } catch {
      // Invalid/manual JSON: we preserve the file and don't touch it. Better to
      // warn the user than to corrupt their config.
      return { tool, file, outcome: 'unchanged' };
    }
  }

  const format = tool.mcpFormat ?? 'standard';
  const rootKey = tool.rootKey;
  const servers =
    config[rootKey] && typeof config[rootKey] === 'object' && !Array.isArray(config[rootKey])
      ? (config[rootKey] as Record<string, unknown>)
      : {};

  const desired = agenticServerEntry(format);
  const current = servers[MCP_SERVER_NAME];

  // For OpenCode, add the config `$schema` on a fresh file (matches its docs).
  const wantsSchema =
    format === 'opencode' && !existed && config['$schema'] === undefined;

  if (existed && current !== undefined && sameEntry(current, desired)) {
    return { tool, file, outcome: 'unchanged' };
  }

  servers[MCP_SERVER_NAME] = desired;
  config[rootKey] = servers;
  if (wantsSchema) {
    // Put $schema first for readability by rebuilding the object.
    config = { $schema: 'https://opencode.ai/config.json', ...config };
  }

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');

  return { tool, file, outcome: existed ? 'updated' : 'created' };
}

/** Configures several tools in sequence. */
export async function setupTools(root: string, tools: readonly AiTool[]): Promise<ToolSetupResult[]> {
  const results: ToolSetupResult[] = [];
  for (const tool of tools) {
    results.push(await setupTool(root, tool));
  }
  return results;
}
