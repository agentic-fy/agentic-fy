import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { resolveProjectPaths, serializeProjectConfig } from './change.js';
import { DEFAULT_PROJECT_CONFIG } from './schema.js';
import { AiTool } from './tools.js';
import { setupTools, ToolSetupResult } from './tool-setup.js';

export interface InitResult {
  root: string;
  createdDirs: string[];
  configStatus: 'created' | 'exists';
  tools: ToolSetupResult[];
}

/**
 * Cria apenas a estrutura base do projeto, espelhando o núcleo do `init`
 * do projeto de referência (/base): diretórios + config.yaml.
 *
 * Idempotente:
 * - diretórios são criados com { recursive: true } (não falha se existirem);
 * - o config só é escrito quando ainda não existe.
 *
 * Quando `tools` é informado, também gera/mescla a configuração MCP de cada
 * ferramenta escolhida (apontando para `agentic mcp`), de forma não-destrutiva.
 */
export async function initProject(
  targetPath = '.',
  tools: readonly AiTool[] = []
): Promise<InitResult> {
  const root = path.resolve(targetPath);
  const paths = resolveProjectPaths(root);

  // Diretórios base (com .gitkeep para versionar pastas vazias).
  const directories = [paths.agenticDir, paths.specsDir, paths.changesDir, paths.archiveDir];
  const createdDirs: string[] = [];
  for (const dir of directories) {
    if (!existsSync(dir)) {
      createdDirs.push(dir);
    }
    await fs.mkdir(dir, { recursive: true });
  }

  await writeGitkeep(paths.specsDir);
  await writeGitkeep(paths.archiveDir);

  // Config: cria só se não existir.
  let configStatus: 'created' | 'exists';
  if (existsSync(paths.configFile)) {
    configStatus = 'exists';
  } else {
    await fs.writeFile(
      paths.configFile,
      serializeProjectConfig(DEFAULT_PROJECT_CONFIG),
      'utf8'
    );
    configStatus = 'created';
  }

  // Configura a integração MCP das ferramentas escolhidas (não-destrutivo).
  const toolResults = tools.length > 0 ? await setupTools(root, tools) : [];

  return { root, createdDirs, configStatus, tools: toolResults };
}

async function writeGitkeep(dir: string): Promise<void> {
  const keep = path.join(dir, '.gitkeep');
  if (!existsSync(keep)) {
    await fs.writeFile(keep, '', 'utf8');
  }
}
