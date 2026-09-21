import type { Command } from 'commander';

/**
 * Comando `completion`: gera um script de autocompletar para o shell.
 *
 * Reescrita enxuta do `completion` do projeto de referência (/base): sem
 * `ora`, sem `@inquirer`, sem instalar nada automaticamente. Apenas imprime o
 * script no stdout para o usuário instalar como preferir. Suporta PowerShell,
 * Bash e Zsh, cobrindo o essencial: completar os subcomandos do agentic.
 */

type Shell = 'powershell' | 'bash' | 'zsh';

/** Lista os subcomandos de topo registrados no programa (para completar). */
function topLevelCommands(program: Command): string[] {
  return program.commands
    .map((c) => c.name())
    .filter((n) => n && n !== 'help')
    .sort();
}

/** Detecta o shell a partir do ambiente; cai em powershell no Windows. */
function detectShell(): Shell | undefined {
  const env = process.env;
  if (env.PSModulePath && process.platform === 'win32') return 'powershell';
  const shell = (env.SHELL ?? '').toLowerCase();
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (process.platform === 'win32') return 'powershell';
  return undefined;
}

function powershellScript(commands: string[]): string {
  const list = commands.map((c) => `'${c}'`).join(', ');
  return `# Autocompletar do agentic (PowerShell)
# Instale adicionando ao seu $PROFILE:
Register-ArgumentCompleter -Native -CommandName agentic -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = @(${list})
  $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;
}

function bashScript(commands: string[]): string {
  return `# Autocompletar do agentic (Bash)
# Instale com: agentic completion bash >> ~/.bashrc  (e recarregue o shell)
_agentic_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${commands.join(' ')}"
  COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
}
complete -F _agentic_completions agentic
`;
}

function zshScript(commands: string[]): string {
  return `# Autocompletar do agentic (Zsh)
# Instale com: agentic completion zsh >> ~/.zshrc  (e recarregue o shell)
_agentic() {
  local -a commands
  commands=(${commands.join(' ')})
  compadd -- \${commands}
}
compdef _agentic agentic
`;
}

export function registerCompletionCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('completion [shell]')
    .description('Imprime um script de autocompletar (powershell | bash | zsh)')
    .action((shellArg?: string) => {
      try {
        const shell = (shellArg?.toLowerCase() as Shell | undefined) ?? detectShell();
        if (!shell || !['powershell', 'bash', 'zsh'].includes(shell)) {
          throw new Error(
            `Não foi possível determinar o shell. Informe explicitamente: ` +
              `"agentic completion powershell|bash|zsh".`
          );
        }
        const commands = topLevelCommands(program);
        const script =
          shell === 'powershell'
            ? powershellScript(commands)
            : shell === 'bash'
              ? bashScript(commands)
              : zshScript(commands);
        console.log(script);
      } catch (error) {
        failWithError(error);
        process.exit(1);
      }
    });
}
