import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { AiTool } from './tools.js';

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

/** The agentic-fy MCP server definition that we write into the config. */
function agenticServerEntry(): Record<string, unknown> {
  return {
    command: 'npx',
    args: ['-y', 'agentic-fy', 'mcp'],
    disabled: false,
    // Read tools can run without confirmation; write ones cannot.
    autoApprove: ['explore', 'list', 'show', 'validate'],
  };
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

  const rootKey = tool.rootKey;
  const servers =
    config[rootKey] && typeof config[rootKey] === 'object' && !Array.isArray(config[rootKey])
      ? (config[rootKey] as Record<string, unknown>)
      : {};

  const desired = agenticServerEntry();
  const current = servers[MCP_SERVER_NAME];

  if (existed && current !== undefined && sameEntry(current, desired)) {
    return { tool, file, outcome: 'unchanged' };
  }

  servers[MCP_SERVER_NAME] = desired;
  config[rootKey] = servers;

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
