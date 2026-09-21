import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { AiTool } from './tools.js';

/**
 * Geração/merge da configuração MCP por ferramenta.
 *
 * Espelha o propósito do `generateSkillsAndCommands` do projeto de referência
 * (/base) — deixar a ferramenta escolhida pronta para usar o agentic — mas
 * adaptado ao modelo MCP-first: escreve (ou mescla) o arquivo de config MCP da
 * IDE apontando para `agentic mcp`.
 *
 * Melhorias sobre o /base:
 *  - merge NÃO-destrutivo: preserva outros servidores e chaves do usuário;
 *  - idempotente: rodar de novo não duplica nem sobrescreve config manual;
 *  - sem dependências (JSON nativo).
 */

/** Nome do servidor MCP do agentic dentro do arquivo de config. */
export const MCP_SERVER_NAME = 'agentic';

export type ToolSetupOutcome = 'created' | 'updated' | 'unchanged';

export interface ToolSetupResult {
  tool: AiTool;
  file: string;
  outcome: ToolSetupOutcome;
}

/** A definição do servidor MCP do agentic que escrevemos na config. */
function agenticServerEntry(): Record<string, unknown> {
  return {
    command: 'npx',
    args: ['-y', '@agentic-fy/agentic', 'mcp'],
    disabled: false,
    // Ferramentas de leitura podem rodar sem confirmação; as de escrita não.
    autoApprove: ['explore', 'list', 'show', 'validate'],
  };
}

/** Compara duas entradas de servidor de forma estável (ordem de chaves). */
function sameEntry(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Escreve/mescla a config MCP de uma ferramenta. Não sobrescreve outros
 * servidores nem chaves já presentes; só garante que o servidor `agentic`
 * exista e esteja atualizado.
 */
export async function setupTool(root: string, tool: AiTool): Promise<ToolSetupResult> {
  const file = path.join(root, tool.mcpConfigPath);

  // Lê a config existente (tolerante a arquivo ausente ou JSON inválido).
  let config: Record<string, unknown> = {};
  let existed = false;
  if (existsSync(file)) {
    existed = true;
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>;
      }
    } catch {
      // JSON inválido/manual: preservamos o arquivo e não mexemos. Melhor
      // avisar o usuário do que corromper a config dele.
      return { tool, file, outcome: 'unchanged' };
    }
  }

  const rootKey = tool.rootKey;
  const servers =
    config[rootKey] && typeof config[rootKey] === 'object' && !Array.isArray(config[rootKey])
      ? (config[rootKey] as Record<string, unknown>)
      : {};

  const desired = agenticServerEntry();
  const current = servers[MCP_SERVER_NAME];

  if (existed && current !== undefined && sameEntry(current, desired)) {
    return { tool, file, outcome: 'unchanged' };
  }

  servers[MCP_SERVER_NAME] = desired;
  config[rootKey] = servers;

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');

  return { tool, file, outcome: existed ? 'updated' : 'created' };
}

/** Configura várias ferramentas em sequência. */
export async function setupTools(root: string, tools: readonly AiTool[]): Promise<ToolSetupResult[]> {
  const results: ToolSetupResult[] = [];
  for (const tool of tools) {
    results.push(await setupTool(root, tool));
  }
  return results;
}
