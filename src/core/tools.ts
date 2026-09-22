import { existsSync } from 'fs';
import path from 'path';

/**
 * Catalog of AI tools supported by agentic-fy's MCP integration.
 *
 * Mirrors the names/ids from the reference project (/base, `AI_TOOLS`), but with
 * agentic-fy's focus: instead of generating per-tool markdown skills, agentic-fy is
 * MCP-first and generates the *MCP configuration* of each IDE pointing to
 * `agentic-fy mcp`. That's why each entry describes WHERE that tool's MCP config
 * file lives and WHICH root key it uses.
 *
 * No new dependencies.
 */

/** Root key of the MCP config JSON: most use `mcpServers`; the VS Code
 * (Copilot) default uses `servers`. */
export type McpRootKey = 'mcpServers' | 'servers';

export interface AiTool {
  /** Stable id (used in --tools and pre-selection). Mirrors /base. */
  id: string;
  /** Friendly name shown in the prompt. */
  name: string;
  /** Path (relative to the project root) of the MCP config file. */
  mcpConfigPath: string;
  /** Root key where the MCP servers are declared. */
  rootKey: McpRootKey;
  /**
   * Paths (relative to the root) whose existence indicates the tool is already
   * used in the project — enables pre-selection in the prompt, like in /base.
   */
  detectionPaths: string[];
}

/**
 * Supported tools. A lean, practical list: the most common and best-documented
 * MCP-capable IDEs/agents. Easy to extend — just add an entry here.
 */
export const AI_TOOLS: readonly AiTool[] = [
  {
    id: 'kiro',
    name: 'Kiro',
    mcpConfigPath: path.join('.kiro', 'settings', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.kiro'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    mcpConfigPath: path.join('.cursor', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.cursor'],
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot (VS Code)',
    mcpConfigPath: path.join('.vscode', 'mcp.json'),
    rootKey: 'servers',
    detectionPaths: ['.vscode', '.github/copilot-instructions.md'],
  },
  {
    id: 'claude',
    name: 'Claude Code',
    mcpConfigPath: path.join('.mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.claude', '.mcp.json'],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    mcpConfigPath: path.join('.windsurf', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.windsurf'],
  },
] as const;

/** All valid ids, in catalog order. */
export const ALL_TOOL_IDS: readonly string[] = AI_TOOLS.map((t) => t.id);

/** Looks up a tool by id. */
export function findTool(id: string): AiTool | undefined {
  return AI_TOOLS.find((t) => t.id === id.trim().toLowerCase());
}

/**
 * Detects which tools are already used in the project (some detectionPath
 * exists). Used to pre-select the tools in the interactive prompt.
 */
export function detectTools(root: string): AiTool[] {
  return AI_TOOLS.filter((tool) =>
    tool.detectionPaths.some((p) => existsSync(path.join(root, p)))
  );
}
