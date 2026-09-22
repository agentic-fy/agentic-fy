import type { Command } from 'commander';

/**
 * `completion` command: generates a shell autocompletion script.
 *
 * A lean rewrite of the `completion` command from the reference project
 * (/base): no `ora`, no `@inquirer`, no automatic installation. It just prints
 * the script to stdout for the user to install however they prefer. Supports
 * PowerShell, Bash, and Zsh, covering the essentials: completing agentic-fy's subcommands.
 */

type Shell = 'powershell' | 'bash' | 'zsh';

/** Lists the top-level subcommands registered in the program (for completion). */
function topLevelCommands(program: Command): string[] {
  return program.commands
    .map((c) => c.name())
    .filter((n) => n && n !== 'help')
    .sort();
}

/** Detects the shell from the environment; falls back to powershell on Windows. */
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
  return `# agentic-fy autocompletion (PowerShell)
# Install by adding to your $PROFILE:
Register-ArgumentCompleter -Native -CommandName agentic-fy -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = @(${list})
  $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;
}

function bashScript(commands: string[]): string {
  return `# agentic-fy autocompletion (Bash)
# Install with: agentic-fy completion bash >> ~/.bashrc  (then reload the shell)
_agenticfy_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${commands.join(' ')}"
  COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
}
complete -F _agenticfy_completions agentic-fy
`;
}

function zshScript(commands: string[]): string {
  return `# agentic-fy autocompletion (Zsh)
# Install with: agentic-fy completion zsh >> ~/.zshrc  (then reload the shell)
_agenticfy() {
  local -a commands
  commands=(${commands.join(' ')})
  compadd -- \${commands}
}
compdef _agenticfy agentic-fy
`;
}

export function registerCompletionCommand(
  program: Command,
  failWithError: (error: unknown) => void
): void {
  program
    .command('completion [shell]')
    .description('Prints an autocompletion script (powershell | bash | zsh)')
    .action((shellArg?: string) => {
      try {
        const shell = (shellArg?.toLowerCase() as Shell | undefined) ?? detectShell();
        if (!shell || !['powershell', 'bash', 'zsh'].includes(shell)) {
          throw new Error(
            `Could not determine the shell. Specify it explicitly: ` +
              `"agentic-fy completion powershell|bash|zsh".`
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
