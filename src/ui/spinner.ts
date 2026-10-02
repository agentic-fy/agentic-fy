/**
 * Minimal, dependency-free step spinner for the CLI.
 *
 * Each step shows a braille spinner while work runs and resolves to a ✓ (or ✗)
 * when it finishes. Behavior is tuned to stay honest, never theatrical:
 *
 *  - TTY only: in a pipe/CI it prints the final line once, no control chars.
 *  - No artificial delay to pad the work. The spinner only spins while the work
 *    actually runs.
 *  - Optional grace period (`delay`): the spinning frames only start if the
 *    step lasts longer than `delay` ms. A step that finishes first shows just
 *    the final ✓ line — so fast commands stay clean, and the spinner appears
 *    only when there's real waiting (slow disk, large project, running tests).
 *
 * Colors are stripped when NO_COLOR is set, matching the rest of the CLI.
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

const noColor = () => process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true';
const green = (s: string) => (noColor() ? s : `\x1b[32m${s}\x1b[0m`);
const red = (s: string) => (noColor() ? s : `\x1b[31m${s}\x1b[0m`);
const dim = (s: string) => (noColor() ? s : `\x1b[2m${s}\x1b[0m`);

export interface Spinner {
  /** Replaces the current line with a success mark and the given text. */
  succeed(text: string): void;
  /** Replaces the current line with a failure mark and the given text. */
  fail(text: string): void;
}

export interface StepOptions {
  /**
   * Grace period in ms before the spinner starts animating. The spinner only
   * appears if the step outlives this delay; otherwise just the final line is
   * printed. Default 0 (animate immediately — use for steps that always wait,
   * like running evidence commands).
   */
  delay?: number;
}

/**
 * Starts a spinner for a single step. Returns a handle to resolve it.
 * `label` is the in-progress text (e.g. "Creating project structure...").
 */
export function startStep(label: string, options: StepOptions = {}): Spinner {
  const out = process.stdout;
  const isTty = Boolean(out.isTTY);

  if (!isTty) {
    // Non-interactive: no animation. The final succeed/fail line is printed
    // once when the step resolves, so logs stay clean.
    return {
      succeed: (text) => out.write(`${green('✓')} ${text}\n`),
      fail: (text) => out.write(`${red('✗')} ${text}\n`),
    };
  }

  const delay = Math.max(0, options.delay ?? 0);
  let i = 0;
  let drawn = false;
  let timer: NodeJS.Timeout | null = null;
  let startTimer: NodeJS.Timeout | null = null;

  const render = () => {
    const frame = dim(FRAMES[i % FRAMES.length]);
    // \r + clear-to-end-of-line so a shorter next frame leaves no leftovers.
    out.write(`\r\x1b[2K${frame} ${label}`);
    drawn = true;
    i += 1;
  };

  const begin = () => {
    render();
    timer = setInterval(render, INTERVAL_MS);
  };

  if (delay === 0) {
    begin();
  } else {
    // Defer animation; if the step resolves first, it never draws.
    startTimer = setTimeout(begin, delay);
  }

  const stop = (mark: string, text: string) => {
    if (startTimer) clearTimeout(startTimer);
    if (timer) clearInterval(timer);
    // Only clear the line if a spinner frame was actually drawn; otherwise just
    // emit the final line (nothing to erase).
    const prefix = drawn ? '\r\x1b[2K' : '';
    out.write(`${prefix}${mark} ${text}\n`);
  };

  return {
    succeed: (text) => stop(green('✓'), text),
    fail: (text) => stop(red('✗'), text),
  };
}
