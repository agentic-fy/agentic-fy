import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { resolveProjectPaths, serializeProjectConfig } from './change.js';
import { DEFAULT_PROJECT_CONFIG } from './schema.js';
import { AiTool } from './tools.js';
import { setupTools, ToolSetupResult } from './tool-setup.js';
import { generateSkills, SkillSetupResult } from './skills.js';

export interface InitResult {
  root: string;
  createdDirs: string[];
  configStatus: 'created' | 'exists';
  tools: ToolSetupResult[];
  /** Slash-command / skill generation results per tool (may be empty). */
  skills: SkillSetupResult[];
}

/** A phase of `initProject`, reported through the optional progress callback. */
export type InitPhase = 'structure' | 'config' | 'tools' | 'skills';

export interface InitProgressEvent {
  phase: InitPhase;
  stage: 'start' | 'done';
  /** A short human summary available when stage === 'done'. */
  detail?: string;
}

export interface InitOptions {
  /**
   * Optional progress callback. The core stays presentation-free: it only
   * emits structured events (start/done per phase); the CLI decides how to
   * render them (e.g. a spinner). Phases that don't apply (no tools) are not
   * emitted at all.
   */
  onProgress?: (event: InitProgressEvent) => void;
}

/**
 * Creates only the base project structure, mirroring the core of the `init`
 * command from the reference project (/base): directories + config.yaml.
 *
 * Idempotent:
 * - directories are created with { recursive: true } (does not fail if they exist);
 * - the config is only written when it doesn't exist yet.
 *
 * When `tools` is provided, it also (both non-destructively):
 *  - generates/merges the MCP configuration of each selected tool (pointing to
 *    `agentic-fy mcp`);
 *  - generates the slash commands and skills for tools that read them.
 */
export async function initProject(
  targetPath = '.',
  tools: readonly AiTool[] = [],
  options: InitOptions = {}
): Promise<InitResult> {
  const root = path.resolve(targetPath);
  const paths = resolveProjectPaths(root);
  const emit = options.onProgress ?? (() => {});

  // Base directories (with .gitkeep to version empty folders).
  emit({ phase: 'structure', stage: 'start' });
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
  emit({
    phase: 'structure',
    stage: 'done',
    detail: createdDirs.length > 0 ? 'Structure created' : 'Structure already existed',
  });

  // Config: create only if it doesn't exist.
  emit({ phase: 'config', stage: 'start' });
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
  emit({
    phase: 'config',
    stage: 'done',
    detail: configStatus === 'created' ? 'Config created' : 'Config already existed',
  });

  // Configure the MCP integration of the selected tools (non-destructive).
  // The tools/skills phases are only emitted when there is something to do.
  let toolResults: ToolSetupResult[] = [];
  if (tools.length > 0) {
    emit({ phase: 'tools', stage: 'start' });
    toolResults = await setupTools(root, tools);
    emit({
      phase: 'tools',
      stage: 'done',
      detail: `${toolResults.length} tool${toolResults.length === 1 ? '' : 's'} configured`,
    });
  }

  // Generate slash commands / skills for tools that read them (non-destructive).
  let skillResults: SkillSetupResult[] = [];
  if (tools.length > 0) {
    emit({ phase: 'skills', stage: 'start' });
    skillResults = await generateSkills(root, tools);
    const totalCmds = skillResults.reduce((n, s) => n + s.commands.created + s.commands.updated, 0);
    const totalSkills = skillResults.reduce((n, s) => n + s.skills.created + s.skills.updated, 0);
    emit({
      phase: 'skills',
      stage: 'done',
      detail: `${totalCmds} command${totalCmds === 1 ? '' : 's'}, ${totalSkills} skill${totalSkills === 1 ? '' : 's'}`,
    });
  }

  return { root, createdDirs, configStatus, tools: toolResults, skills: skillResults };
}

async function writeGitkeep(dir: string): Promise<void> {
  const keep = path.join(dir, '.gitkeep');
  if (!existsSync(keep)) {
    await fs.writeFile(keep, '', 'utf8');
  }
}
