import { existsSync } from 'fs';
import path from 'path';

/**
 * Catálogo das ferramentas de IA suportadas pela integração MCP do agentic.
 *
 * Espelha os nomes/ids do projeto de referência (/base, `AI_TOOLS`), mas com o
 * foco do agentic: em vez de gerar skills em markdown por ferramenta, o
 * agentic é MCP-first e gera a *configuração MCP* de cada IDE apontando para
 * `agentic mcp`. Por isso cada entrada descreve ONDE fica o arquivo de config
 * MCP daquela ferramenta e QUAL a chave-raiz que ela usa.
 *
 * Sem dependências novas.
 */

/** Chave-raiz do JSON de config MCP: a maioria usa `mcpServers`; o padrão
 * do VS Code (Copilot) usa `servers`. */
export type McpRootKey = 'mcpServers' | 'servers';

export interface AiTool {
  /** Id estável (usado em --tools e na pré-seleção). Espelha o /base. */
  id: string;
  /** Nome amigável exibido no prompt. */
  name: string;
  /** Caminho (relativo à raiz do projeto) do arquivo de config MCP. */
  mcpConfigPath: string;
  /** Chave-raiz onde os servidores MCP são declarados. */
  rootKey: McpRootKey;
  /**
   * Caminhos (relativos à raiz) cuja existência indica que a ferramenta já é
   * usada no projeto — habilita a pré-seleção no prompt, como no /base.
   */
  detectionPaths: string[];
}

/**
 * Ferramentas suportadas. Lista enxuta e prática: as IDEs/agentes com suporte
 * a MCP mais comuns e documentados. Fácil de estender — basta adicionar uma
 * entrada aqui.
 */
export const AI_TOOLS: readonly AiTool[] = [
  {
    id: 'kiro',
    name: 'Kiro',
    mcpConfigPath: path.join('.kiro', 'settings', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.kiro'],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    mcpConfigPath: path.join('.cursor', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.cursor'],
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot (VS Code)',
    mcpConfigPath: path.join('.vscode', 'mcp.json'),
    rootKey: 'servers',
    detectionPaths: ['.vscode', '.github/copilot-instructions.md'],
  },
  {
    id: 'claude',
    name: 'Claude Code',
    mcpConfigPath: path.join('.mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.claude', '.mcp.json'],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    mcpConfigPath: path.join('.windsurf', 'mcp.json'),
    rootKey: 'mcpServers',
    detectionPaths: ['.windsurf'],
  },
] as const;

/** Todos os ids válidos, na ordem do catálogo. */
export const ALL_TOOL_IDS: readonly string[] = AI_TOOLS.map((t) => t.id);

/** Busca uma ferramenta pelo id. */
export function findTool(id: string): AiTool | undefined {
  return AI_TOOLS.find((t) => t.id === id.trim().toLowerCase());
}

/**
 * Detecta quais ferramentas já são usadas no projeto (algum detectionPath
 * existe). Usada para pré-selecionar as ferramentas no prompt interativo.
 */
export function detectTools(root: string): AiTool[] {
  return AI_TOOLS.filter((tool) =>
    tool.detectionPaths.some((p) => existsSync(path.join(root, p)))
  );
}
