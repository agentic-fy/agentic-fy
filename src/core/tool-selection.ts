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

/**
 * Chooses which prompt to use. The single-select UI only needs ↑/↓ and Enter —
 * keystrokes every terminal delivers reliably — so it's used whenever there's a
 * raw-mode-capable TTY. The numeric prompt remains the fallback for the genuine
 * no-TTY case (pipes, CI). Returns `null` when the user cancels (Esc / Ctrl-C).
 */
async function promptForTools(preselected: AiTool[]): Promise<AiTool[] | null> {
  const canRaw = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function');
  return canRaw ? promptInteractive(preselected) : promptNumeric(preselected);
}

/**
 * Keyboard-driven SINGLE select: ↑/↓ move the highlight, Enter confirms the
 * highlighted tool, Esc/Ctrl-C cancels (returns `null`). The filled square ◼
 * marks the current cursor line — there is no space-to-toggle, because some
 * terminals (WSL, Git Bash/MSYS) never deliver the spacebar to a raw-mode
 * process. Only ↑/↓ and Enter are needed, which work everywhere. To configure
 * several tools at once, use the non-interactive flag: `--tools kiro,cursor`.
 */
async function promptInteractive(preselected: AiTool[]): Promise<AiTool[] | null> {
  const out = process.stdout;
  const detectedNames = preselected.map((t) => t.name).join(', ');

  // Start the highlight on the first detected tool, if any.
  const firstDetected = AI_TOOLS.findIndex((t) => preselected.some((p) => p.id === t.id));
  let cursor = firstDetected >= 0 ? firstDetected : 0;

  // The header (logo + title) is printed ONCE. Only the option block below is
  // repainted on each keypress, so the multi-line banner never stacks up.
  const printHeader = () => {
    out.write('\n');
    out.write(renderBanner(!noColor()) + '\n');
    out.write('\n');
    out.write(bold('Select an AI tool to integrate') + '\n');
    out.write('\n');
  };

  // Lines that make up the repainted block: one per tool + spacer + detected +
  // spacer + hint. Fixed count, so moving the cursor back up is always exact.
  const blockLines = (): string[] => {
    const lines: string[] = [];
    AI_TOOLS.forEach((tool, i) => {
      const isCursor = i === cursor;
      // The highlighted line is the selection: filled purple square + bold
      // name. Every other line is a dim empty square + dim name.
      const box = isCursor ? purple('◼') : dim('◻');
      const name = isCursor ? bold(tool.name) : dim(tool.name);
      lines.push(`    ${box}  ${name}`);
    });
    lines.push('');
    lines.push(dim('  ' + '─'.repeat(45)));
    lines.push(detectedNames ? dim(`  Detected: ${detectedNames}`) : dim('  Nothing detected'));
    lines.push('');
    lines.push(dim('  ↑/↓ Navigate   Enter Select   Esc Cancel'));
    lines.push(dim('  Tip: for several tools use --tools kiro,cursor'));
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
    // Raw mode so each keystroke arrives immediately (unbuffered). We read the
    // raw 'data' bytes directly rather than readline's keypress events.
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    const moveUp = () => {
      cursor = (cursor - 1 + AI_TOOLS.length) % AI_TOOLS.length;
      drawBlock();
    };
    const moveDown = () => {
      cursor = (cursor + 1) % AI_TOOLS.length;
      drawBlock();
    };
    const confirm = () => {
      cleanup();
      out.write('\n');
      resolve([AI_TOOLS[cursor]]); // single selection
    };
    const cancel = () => {
      cleanup();
      out.write('\n');
      resolve(null); // cancel → the caller aborts init
    };

    /**
     * Reads raw stdin bytes directly. Only three gestures matter for a single
     * select: move (↑/↓, also k/j), confirm (Enter), cancel (Esc/Ctrl-C) —
     * all of which the terminal reliably delivers.
     */
    const onData = (chunk: Buffer) => {
      const s = chunk.toString('utf8');

      if (s === '\x1b[A') return moveUp();
      if (s === '\x1b[B') return moveDown();
      if (s === '\x1b') return cancel(); // lone ESC

      for (const ch of s) {
        if (ch === '\r' || ch === '\n') confirm();
        else if (ch === '\x03') cancel(); // Ctrl-C
        else if (ch === 'k') moveUp();
        else if (ch === 'j') moveDown();
      }
    };

    stdin.on('data', onData);
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
    console.log('Which AI tool should agentic-fy be configured for (MCP)?');
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
        `${hint}Choose one number (Enter accepts the detected; for several use --tools kiro,cursor): `
      )
    ).trim();

    if (answer === '') return preselected;
    if (answer === '0') return [];

    const index = Number.parseInt(answer, 10);
    if (Number.isInteger(index) && index >= 1 && index <= AI_TOOLS.length) {
      return [AI_TOOLS[index - 1]];
    }
    // Unrecognized input: configure nothing rather than guessing.
    return [];
  } finally {
    rl.close();
  }
}
