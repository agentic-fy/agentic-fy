import type { Key } from 'node:readline';

import { AI_TOOLS, AiTool, ALL_TOOL_IDS, detectTools, findTool } from './tools.js';
import { renderBanner } from '../ui/version.js';

/**
 * AI tool selection during `init`.
 *
 * Mirrors `getSelectedTools` from the reference project (/base): resolves a
 * non-interactive flag (`--tools`), detects already-used tools to pre-select
 * them, and falls back to an interactive prompt when there's a TTY.
 *
 * The interactive prompt is a keyboard-driven multi-select (arrows to move,
 * space to toggle, Enter to confirm), rendered with the agentic-fy logo — all
 * dependency-free via Node's native `readline` keypress events. When raw-mode
 * keypress isn't available, it falls back to a simple numeric prompt.
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
 *
 * Returns `null` when the user cancels the interactive prompt (Esc / Ctrl-C),
 * so the caller can abort `init` without creating anything.
 */
export async function selectTools(
  root: string,
  options: ToolSelectionOptions = {}
): Promise<AiTool[] | null> {
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

// ─── styling helpers ─────────────────────────────────────────────────────────

const noColor = () => process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true';
const paint = (code: string, s: string) => (noColor() ? s : `\x1b[${code}m${s}\x1b[0m`);
const purple = (s: string) => paint('38;5;92', s);
const dim = (s: string) => paint('2', s);
const bold = (s: string) => paint('1', s);

/** Chooses which prompt to use based on TTY raw-mode support. Returns `null`
 * when the user cancels (Esc / Ctrl-C). */
async function promptForTools(preselected: AiTool[]): Promise<AiTool[] | null> {
  const canRaw = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function');
  return canRaw ? promptInteractive(preselected) : promptNumeric(preselected);
}

/**
 * Keyboard-driven multi-select: ↑/↓ move, Space toggles, `a` all, `n` none,
 * Enter confirms, Esc/Ctrl-C cancels (returns `null` → the caller aborts).
 */
async function promptInteractive(preselected: AiTool[]): Promise<AiTool[] | null> {
  const readline = await import('node:readline');
  const out = process.stdout;
  const preselectedIds = new Set(preselected.map((t) => t.id));
  const selected = AI_TOOLS.map((t) => preselectedIds.has(t.id));
  let cursor = 0;

  const detectedNames = preselected.map((t) => t.name).join(', ');

  // The header (logo + title) is printed ONCE. Only the option block below is
  // repainted on each keypress, so the multi-line banner never stacks up.
  const printHeader = () => {
    out.write('\n');
    out.write(renderBanner(!noColor()) + '\n');
    out.write('\n');
    out.write(bold('Configure MCP integrations') + '\n');
    out.write('\n');
  };

  // Lines that make up the repainted block: one per tool + spacer + detected +
  // spacer + hint. Fixed count, so moving the cursor back up is always exact.
  const blockLines = (): string[] => {
    const lines: string[] = [];
    AI_TOOLS.forEach((tool, i) => {
      const isCursor = i === cursor;
      const box = selected[i] ? purple('●') : dim('●');
      const pointer = isCursor ? purple('❯') : ' ';
      const name = isCursor ? bold(tool.name) : tool.name;
      lines.push(`  ${pointer} ${box}  ${name}`);
    });
    lines.push('');
    lines.push(dim('  ' + '─'.repeat(45)));
    lines.push(detectedNames ? dim(`  Detected: ${detectedNames}`) : dim('  Nothing detected'));
    lines.push('');
    lines.push(dim('  ↑/↓ Navigate   Space Select   A All   N None'));
    lines.push(dim('  Enter Continue   Esc Cancel'));
    return lines;
  };

  const blockHeight = AI_TOOLS.length + 6;
  let drawnOnce = false;

  const drawBlock = () => {
    if (drawnOnce) out.write(`\x1b[${blockHeight}A`); // back to top of the block
    const lines = blockLines();
    // \r + clear-line on every row so a shorter repaint leaves no leftovers.
    out.write(lines.map((l) => `\r\x1b[2K${l}`).join('\n') + '\n');
    drawnOnce = true;
  };

  return new Promise<AiTool[] | null>((resolve) => {
    const stdin = process.stdin;
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('keypress', onKey);
    };

    const onKey = (_str: string, key: Key) => {
      if (!key) return;
      if (key.name === 'up' || key.name === 'k') {
        cursor = (cursor - 1 + AI_TOOLS.length) % AI_TOOLS.length;
        drawBlock();
      } else if (key.name === 'down' || key.name === 'j') {
        cursor = (cursor + 1) % AI_TOOLS.length;
        drawBlock();
      } else if (key.name === 'space') {
        selected[cursor] = !selected[cursor];
        drawBlock();
      } else if (key.name === 'a') {
        const allOn = selected.every(Boolean);
        selected.fill(!allOn);
        drawBlock();
      } else if (key.name === 'n') {
        selected.fill(false);
        drawBlock();
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        out.write('\n');
        resolve(AI_TOOLS.filter((_, i) => selected[i]));
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        out.write('\n');
        resolve(null); // cancel → the caller aborts init
      }
    };

    stdin.on('keypress', onKey);
    printHeader();
    drawBlock();
  });
}

/**
 * Numeric fallback (no raw-mode TTY): pre-selects the detected tools (marked
 * with "*"); an empty Enter accepts them.
 */
async function promptNumeric(preselected: AiTool[]): Promise<AiTool[]> {
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

    if (answer === '') return preselected;
    if (answer === '0') return [];

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
