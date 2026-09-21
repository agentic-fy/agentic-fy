import { AI_TOOLS, AiTool, ALL_TOOL_IDS, detectTools, findTool } from './tools.js';

/**
 * Seleção das ferramentas de IA no `init`.
 *
 * Espelha o `getSelectedTools` do projeto de referência (/base): resolve uma
 * flag não-interativa (`--tools`), detecta ferramentas já usadas para
 * pré-selecionar, e cai num prompt interativo quando há TTY. Reescrito enxuto
 * e sem dependências: o prompt usa o `readline` nativo do Node.
 */

/**
 * Interpreta o valor de `--tools`. Retorna:
 *  - `AiTool[]` quando a flag foi informada (inclui lista vazia p/ "none");
 *  - `null` quando a flag não foi informada (cai para detecção/prompt).
 * Lança em ids inválidos, com sugestão dos válidos (como no /base).
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
      `Ferramenta(s) inválida(s): ${invalid.join(', ')}. ` +
        `Válidas: ${ALL_TOOL_IDS.join(', ')}. ` +
        `Use --tools all, --tools none, ou --tools kiro,cursor,...`
    );
  }
  return tools;
}

/** True quando dá para abrir um prompt interativo. */
export function canPromptInteractively(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export interface ToolSelectionOptions {
  /** Valor cru de --tools (undefined = não informado). */
  toolsFlag?: string;
  /** Permite forçar modo não-interativo (ex.: testes). */
  interactive?: boolean;
}

/**
 * Decide o conjunto final de ferramentas a configurar.
 *
 * Precedência (espelha o /base):
 *  1. `--tools` (explícito, inclusive `none`);
 *  2. prompt interativo (quando há TTY), pré-selecionando as detectadas;
 *  3. fallback não-interativo: NÃO configura nada (mantém o comportamento
 *     histórico do init do agentic), apenas informando como escolher depois.
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
    // Sem flag e sem TTY: não dá para perguntar. Mantém o init utilizável em
    // CI/pipes sem configurar ferramenta nenhuma.
    return [];
  }

  return promptForTools(detected);
}

/**
 * Prompt interativo por número, com readline nativo. Pré-seleciona as
 * ferramentas detectadas (marcadas com "*"). Enter vazio aceita a pré-seleção.
 */
async function promptForTools(preselected: AiTool[]): Promise<AiTool[]> {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const preselectedIds = new Set(preselected.map((t) => t.id));

  try {
    console.log('Para qual(is) ferramenta(s) configurar o agentic (MCP)?');
    AI_TOOLS.forEach((tool, i) => {
      const mark = preselectedIds.has(tool.id) ? ' *' : '';
      console.log(`  ${i + 1}) ${tool.name}${mark}`);
    });
    console.log('  0) Nenhuma');
    const hint = preselected.length
      ? `Detectada(s): ${preselected.map((t) => t.name).join(', ')}. `
      : '';
    const answer = (
      await rl.question(
        `${hint}Escolha os números separados por vírgula (Enter aceita a[s] detectada[s]): `
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
