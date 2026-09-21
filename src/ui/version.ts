import type { Command } from 'commander';

/**
 * Logo ASCII do agentic exibido no `--version`.
 * Usa sequências ANSI diretas para manter o visual mesmo sem chalk.
 */
const PURPLE = "\x1b[38;5;92m";
const RESET = "\x1b[0m";

const glyphs: Record<string, string[]> = {
  A: [" ███ ", "█   █", "█████", "█   █", "█   █"],
  G: [" ████", "█    ", "█  ██", "█   █", " ███ "],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"],
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  I: ["███", " █ ", " █ ", " █ ", "███"],
  C: [" ████", "█    ", "█    ", "█    ", " ████"],
};

const render = (text: string, slant = false): string => {
  const rows = Array.from({ length: 5 }, (_, row) => {
    const line = [...text].map((ch) => glyphs[ch][row]).join(" ");
    // deslocamento progressivo para dar efeito itálico
    return slant ? " ".repeat(4 - row) + line : line;
  });
  return rows.map((r) => `${PURPLE}${r}${RESET}`).join("\n");
};

export const logo = `
${render("AGENTIC", true)}
`;

/**
 * Monta o texto do `--version`: logo + versão + lista de todos os comandos
 * disponíveis (nome, argumentos e descrição), lidos do próprio program.
 */
export function renderVersion(program: Command, version: string): string {
  const noColor = process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true';
  const bold = (s: string) => (noColor ? s : `\x1b[1m${s}\x1b[0m`);
  const dim = (s: string) => (noColor ? s : `\x1b[2m${s}\x1b[0m`);
  const header = noColor ? logo.replace(/\x1b\[[0-9;]*m/g, '') : logo;

  const lines: string[] = [];
  lines.push(header);
  lines.push(`${bold('agentic')} v${version}`);
  lines.push('');
  lines.push(bold('Comandos disponíveis:'));

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
