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
 * Creates only the base project structure, mirroring the core of the `init`
 * command from the reference project (/base): directories + config.yaml.
 *
 * Idempotent:
 * - directories are created with { recursive: true } (does not fail if they exist);
 * - the config is only written when it doesn't exist yet.
 *
 * When `tools` is provided, it also generates/merges the MCP configuration of
 * each selected tool (pointing to `agentic-fy mcp`), non-destructively.
 */
export async function initProject(
  targetPath = '.',
  tools: readonly AiTool[] = []
): Promise<InitResult> {
  const root = path.resolve(targetPath);
  const paths = resolveProjectPaths(root);

  // Base directories (with .gitkeep to version empty folders).
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

  // Config: create only if it doesn't exist.
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

  // Configure the MCP integration of the selected tools (non-destructive).
  const toolResults = tools.length > 0 ? await setupTools(root, tools) : [];

  return { root, createdDirs, configStatus, tools: toolResults };
}

async function writeGitkeep(dir: string): Promise<void> {
  const keep = path.join(dir, '.gitkeep');
  if (!existsSync(keep)) {
    await fs.writeFile(keep, '', 'utf8');
  }
}
