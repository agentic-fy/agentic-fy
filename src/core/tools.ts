import { existsSync } from 'fs';
import path from 'path';

/**
 * Catalog of AI tools supported by agentic-fy.
 *
 * Mirrors the names/ids from the reference project (/base, `AI_TOOLS`).
 * agentic-fy integrates with a tool in two complementary ways:
 *
 *  1. MCP config: generates the *MCP configuration* of each IDE pointing to
 *     `agentic-fy mcp` (WHERE the config file lives + WHICH root key it uses).
 *  2. Slash commands / skills: for tools that read them (Claude Code, Cursor,
 *     Kiro, ...), generates markdown command and skill files in the repo so the
 *     tool registers commands like `/agentic-fy:propose` and auto-invocable
 *     skills. `skillsDir` says WHERE, `commandStyle` says HOW they're invoked.
 *
 * No new dependencies.
 */

/** Root key of the MCP config JSON: most use `mcpServers`; the VS Code
 * (Copilot) default uses `servers`. */
export type McpRootKey = 'mcpServers' | 'servers';

/**
 * How a tool spells a generated command:
 *  - 'namespaced': files live in `<commandsDir>/agentic-fy/<id>.md`, registered
 *    as `/agentic-fy:<id>` (Claude Code, Gemini, ...).
 *  - 'flat': files are `<commandsDir>/agentic-fy-<id>.md`, registered as
 *    `/agentic-fy-<id>` (Cursor, GitHub Copilot, ...).
 */
export type CommandStyle = 'namespaced' | 'flat';

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
  /**
   * Base directory (relative to the root) where this tool reads skills and
   * commands, e.g. `.claude`. Skills go to `<skillsDir>/skills/<name>/SKILL.md`
   * and commands to `<skillsDir>/commands/...`. Omit when the tool has no
   * skill/command surface (only MCP).
   */
  skillsDir?: string;
  /** How generated commands are invoked. Defaults to 'namespaced'. */
  commandStyle?: CommandStyle;
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
    skillsDir: '.kiro',
    commandStyle: 'namespaced',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    mcpConfigPath: path.join('.cursor', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.cursor'],
    skillsDir: '.cursor',
    commandStyle: 'flat',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot (VS Code)',
    mcpConfigPath: path.join('.vscode', 'mcp.json'),
    rootKey: 'servers',
    detectionPaths: ['.vscode', '.github/copilot-instructions.md'],
    skillsDir: '.github',
    commandStyle: 'flat',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    mcpConfigPath: path.join('.mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.claude', '.mcp.json'],
    skillsDir: '.claude',
    commandStyle: 'namespaced',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    mcpConfigPath: path.join('.windsurf', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.windsurf'],
    skillsDir: '.windsurf',
    commandStyle: 'namespaced',
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
