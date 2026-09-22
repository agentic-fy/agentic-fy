import type { Command } from 'commander';

/**
 * agentic-fy ASCII logo shown in `--version`.
 * Uses direct ANSI sequences to keep the look even without chalk.
 */
const PURPLE = "\x1b[38;5;92m";
const RESET = "\x1b[0m";

/** Upright block banner (no italic slant). */
const BANNER = [
  " █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗ ██████╗",
  "██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝",
  "███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║██║     ",
  "██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║     ",
  "██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗",
  "╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝ ",
];

/** Renders the banner in purple. */
function renderBanner(): string {
  return BANNER.map((row) => `${PURPLE}${row}${RESET}`).join("\n");
}

/**
 * Builds a centered, boxed label placed below the banner.
 * The box width matches the banner width so it lines up under the logo.
 */
function renderLabel(text: string): string {
  const bannerWidth = Math.max(...BANNER.map((r) => r.length));
  const inner = bannerWidth - 2; // space between the box borders
  const padTotal = Math.max(0, inner - text.length);
  const left = Math.floor(padTotal / 2);
  const right = padTotal - left;
  const top = `┌${"─".repeat(inner)}┐`;
  const mid = `│${" ".repeat(left)}${text}${" ".repeat(right)}│`;
  const bottom = `└${"─".repeat(inner)}┘`;
  return [top, mid, bottom].map((r) => `${PURPLE}${r}${RESET}`).join("\n");
}

export const logo = `
${renderBanner()}
`;

/**
 * Builds the `--version` text: logo + version + list of all available commands
 * (name, arguments, and description), read from the program itself.
 */
export function renderVersion(program: Command, version: string): string {
  const noColor = process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true';
  const bold = (s: string) => (noColor ? s : `\x1b[1m${s}\x1b[0m`);
  const dim = (s: string) => (noColor ? s : `\x1b[2m${s}\x1b[0m`);
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

  const label = renderLabel(`ATENTIC FY - V${version}`);
  const header = noColor ? strip(logo) : logo;
  const labelBlock = noColor ? strip(label) : label;

  const lines: string[] = [];
  lines.push(header);
  lines.push(labelBlock);
  lines.push('');
  lines.push(bold('Available commands:'));

  const commands = program.commands.filter((cmd) => !(cmd as { _hidden?: boolean })._hidden);
  const usages = commands.map((cmd) => cmd.name() + (cmd.usage() ? ` ${cmd.usage()}` : ''));
  const width = usages.reduce((max, u) => Math.max(max, u.length), 0);

  commands.forEach((cmd, i) => {
    const usage = usages[i].padEnd(width + 2);
    const desc = cmd.description();
    lines.push(`  ${usage}${desc ? dim(desc) : ''}`);
  });

  lines.push('');
  return lines.join('\n');
}
