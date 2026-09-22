import { AI_TOOLS, AiTool, ALL_TOOL_IDS, detectTools, findTool } from './tools.js';

/**
 * AI tool selection during `init`.
 *
 * Mirrors `getSelectedTools` from the reference project (/base): resolves a
 * non-interactive flag (`--tools`), detects already-used tools to pre-select
 * them, and falls back to an interactive prompt when there's a TTY. Rewritten
 * lean and dependency-free: the prompt uses Node's native `readline`.
 */

/**
 * Interprets the value of `--tools`. Returns:
 *  - `AiTool[]` when the flag was provided (includes an empty list for "none");
 *  - `null` when the flag was not provided (falls back to detection/prompt).
 * Throws on invalid ids, suggesting the valid ones (like in /base).
 */
export function resolveToolsFlag(value: string | undefined): AiTool[] | null {
  if (value === undefined) return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'all') return [...AI_TOOLS];
  if (normalized === 'none' || normalized === '') return [];

  const ids = normalized
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const tools: AiTool[] = [];
  const invalid: string[] = [];
  for (const id of ids) {
    const tool = findTool(id);
    if (tool) {
      if (!tools.some((t) => t.id === tool.id)) tools.push(tool);
    } else {
      invalid.push(id);
    }
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid tool(s): ${invalid.join(', ')}. ` +
        `Valid: ${ALL_TOOL_IDS.join(', ')}. ` +
        `Use --tools all, --tools none, or --tools kiro,cursor,...`
    );
  }
  return tools;
}

/** True when an interactive prompt can be opened. */
export function canPromptInteractively(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export interface ToolSelectionOptions {
  /** Raw value of --tools (undefined = not provided). */
  toolsFlag?: string;
  /** Allows forcing non-interactive mode (e.g. tests). */
  interactive?: boolean;
}

/**
 * Decides the final set of tools to configure.
 *
 * Precedence (mirrors /base):
 *  1. `--tools` (explicit, including `none`);
 *  2. interactive prompt (when there's a TTY), pre-selecting the detected ones;
 *  3. non-interactive fallback: does NOT configure anything (keeps agentic-fy's
 *     historical init behavior), only informing how to choose later.
 */
export async function selectTools(
  root: string,
  options: ToolSelectionOptions = {}
): Promise<AiTool[]> {
  const fromFlag = resolveToolsFlag(options.toolsFlag);
  if (fromFlag !== null) {
    return fromFlag;
  }

  const detected = detectTools(root);
  const interactive = options.interactive ?? canPromptInteractively();

  if (!interactive) {
    // No flag and no TTY: can't ask. Keeps init usable in CI/pipes without
    // configuring any tool.
    return [];
  }

  return promptForTools(detected);
}

/**
 * Interactive prompt by number, with native readline. Pre-selects the detected
 * tools (marked with "*"). An empty Enter accepts the pre-selection.
 */
async function promptForTools(preselected: AiTool[]): Promise<AiTool[]> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const preselectedIds = new Set(preselected.map((t) => t.id));

  try {
    console.log('Which tool(s) should agentic-fy be configured for (MCP)?');
    AI_TOOLS.forEach((tool, i) => {
      const mark = preselectedIds.has(tool.id) ? ' *' : '';
      console.log(`  ${i + 1}) ${tool.name}${mark}`);
    });
    console.log('  0) None');
    const hint = preselected.length
      ? `Detected: ${preselected.map((t) => t.name).join(', ')}. `
      : '';
    const answer = (
      await rl.question(
        `${hint}Choose the numbers separated by commas (Enter accepts the detected one[s]): `
      )
    ).trim();

    if (answer === '') {
      return preselected;
    }
    if (answer === '0') {
      return [];
    }

    const picked: AiTool[] = [];
    for (const token of answer.split(',').map((s) => s.trim()).filter(Boolean)) {
      const index = Number.parseInt(token, 10);
      if (Number.isInteger(index) && index >= 1 && index <= AI_TOOLS.length) {
        const tool = AI_TOOLS[index - 1];
        if (!picked.some((t) => t.id === tool.id)) picked.push(tool);
      }
    }
    return picked;
  } finally {
    rl.close();
  }
}
