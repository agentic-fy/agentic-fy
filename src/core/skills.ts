import { promises as fs, existsSync } from 'fs';
import path from 'path';

import { AiTool, CommandStyle } from './tools.js';

/**
 * Generation of per-tool slash commands and skills as files in the repo.
 *
 * This mirrors the idea of the reference project (/base): besides the MCP
 * integration, agentic-fy writes markdown files that AI tools (Claude Code,
 * Cursor, Kiro, ...) read to register commands like `/agentic-fy:propose` and
 * auto-invocable skills. It complements the MCP config — the commands guide the
 * agent through the workflow while the MCP server exposes the actual tools.
 *
 * Layout per tool (base = tool.skillsDir, e.g. `.claude`):
 *  - commands (namespaced): <base>/commands/agentic-fy/<id>.md   → /agentic-fy:<id>
 *  - commands (flat):       <base>/commands/agentic-fy-<id>.md    → /agentic-fy-<id>
 *  - skills:                <base>/skills/agentic-fy-<id>/SKILL.md
 *
 * Non-destructive and idempotent: existing files are only overwritten when the
 * content actually changes (so a user's manual tweaks in unrelated files are
 * never touched, and re-running init doesn't churn the tree).
 */

/** Pre-approved tool for generated skills/commands (Agent Skills standard). */
const ALLOWED_TOOLS = 'Bash(agentic-fy:*)';

export interface WorkflowTemplate {
  /** Command id and skill suffix (e.g. 'propose' → /agentic-fy:propose). */
  id: string;
  /** Human title used in the command frontmatter `name`. */
  title: string;
  /** One-line description (shown in the command palette / skill trigger). */
  description: string;
  /** Markdown body: the prompt injected when the command/skill runs. */
  body: string;
}

/**
 * The workflow templates agentic-fy generates. Kept focused on the core loop
 * plus the most useful inspection commands. Bodies are authored in the
 * canonical `/agentic-fy:<id>` form and rewritten per tool when needed.
 */
export const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[] = [
  {
    id: 'explore',
    title: 'agentic-fy: Explore',
    description:
      'Map the problem and understand the codebase before proposing a change (thinking mode). Use when the user wants to think through an idea before writing code.',
    body: `Enter explore mode for agentic-fy. Do NOT implement anything yet.

1. Run \`agentic-fy explore\` to confirm the project and list active changes.
2. Map the problem: read the relevant code and summarize the current behavior.
3. When the picture is clear, hand off to \`/agentic-fy:propose <name>\` to capture the change.`,
  },
  {
    id: 'propose',
    title: 'agentic-fy: Propose',
    description:
      'Create a change and draft its artifacts (proposal, design, tasks, spec). Use when the user describes something to build. Also triggers on "agentic-fy propose".',
    body: `Propose a new agentic-fy change.

**Input**: the argument after \`/agentic-fy:propose\` is the change name (kebab-case, e.g. add-dark-mode).

1. Run \`agentic-fy propose <name>\` to scaffold the change and its artifacts.
2. Fill in the artifacts with real content:
   - \`proposal.md\` - the why and what (intent, scope).
   - \`specs/spec.md\` - requirements and acceptance criteria.
   - \`design.md\` - the technical approach.
   - \`tasks.md\` - an implementation checklist using \`- [ ]\` checkboxes.
3. Validate with \`agentic-fy validate <name>\` and fix any reported issues.
4. Hand off to \`/agentic-fy:apply <name>\` to implement.`,
  },
  {
    id: 'apply',
    title: 'agentic-fy: Apply',
    description:
      'Implement the tasks of a change from its tasks.md. Use when the plan is ready and it is time to write code.',
    body: `Implement an agentic-fy change.

1. Run \`agentic-fy apply <name>\` to read tasks.md and see what is pending.
2. Implement the pending tasks in order, keeping alignment with design.md and specs/.
3. As each task is completed, mark it \`- [x]\` in tasks.md.
4. When everything is done, hand off to \`/agentic-fy:verify <name>\`.`,
  },
  {
    id: 'verify',
    title: 'agentic-fy: Verify',
    description:
      'Verify the implementation against the spec and mark the change verified. Use before archiving.',
    body: `Verify an agentic-fy change.

1. Run \`agentic-fy verify <name>\`.
2. If artifacts are missing or tasks are still pending, resolve them and run verify again.
3. Once it reports the change as verified, hand off to \`/agentic-fy:archive <name>\`.`,
  },
  {
    id: 'archive',
    title: 'agentic-fy: Archive',
    description: 'Archive a completed, verified change. Use when the work is done.',
    body: `Archive a completed agentic-fy change.

1. Confirm the change is verified.
2. Run \`agentic-fy archive <name>\` to move it into changes/archive/ and mark it archived.`,
  },
];

/** Escapes a value for safe single-line YAML frontmatter. */
function yamlValue(value: string): string {
  if (/[:#"'\n]|^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

/** Rewrites canonical `/agentic-fy:<id>` references for a flat-style tool. */
function applyCommandStyle(body: string, style: CommandStyle): string {
  if (style === 'flat') {
    return body.replace(/\/agentic-fy:([a-z-]+)/g, '/agentic-fy-$1');
  }
  return body;
}

/** Builds the SKILL.md content (frontmatter + body). */
function renderSkill(t: WorkflowTemplate, style: CommandStyle): string {
  const body = applyCommandStyle(t.body, style);
  return `---
name: agentic-fy-${t.id}
description: ${yamlValue(t.description)}
allowed-tools: ${ALLOWED_TOOLS}
license: MIT
metadata:
  author: agentic-fy
  version: "1.0"
---

${body}
`;
}

/** Builds a slash-command file content (frontmatter + body). */
function renderCommand(t: WorkflowTemplate, style: CommandStyle): string {
  const body = applyCommandStyle(t.body, style);
  return `---
name: ${yamlValue(t.title)}
description: ${yamlValue(t.description)}
allowed-tools: ${ALLOWED_TOOLS}
category: Workflow
tags:
  - agentic-fy
  - workflow
---

${body}
`;
}

/** Path (relative to root) of a generated command file for a tool. */
function commandPath(tool: AiTool, id: string): string {
  const base = path.join(tool.skillsDir as string, 'commands');
  return tool.commandStyle === 'flat'
    ? path.join(base, `agentic-fy-${id}.md`)
    : path.join(base, 'agentic-fy', `${id}.md`);
}

/** Path (relative to root) of a generated SKILL.md for a tool. */
function skillPath(tool: AiTool, id: string): string {
  return path.join(tool.skillsDir as string, 'skills', `agentic-fy-${id}`, 'SKILL.md');
}

export type SkillOutcome = 'created' | 'updated' | 'unchanged';

export interface SkillSetupResult {
  tool: AiTool;
  /** Number of command files created/updated/unchanged. */
  commands: { created: number; updated: number; unchanged: number };
  /** Number of skill files created/updated/unchanged. */
  skills: { created: number; updated: number; unchanged: number };
}

/** Writes a file only if content changed; returns the outcome. */
async function writeIfChanged(file: string, content: string): Promise<SkillOutcome> {
  if (existsSync(file)) {
    const current = await fs.readFile(file, 'utf8');
    if (current === content) return 'unchanged';
    await fs.writeFile(file, content, 'utf8');
    return 'updated';
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
  return 'created';
}

/**
 * Generates the slash commands and skills for a single tool. No-op (returns
 * zeroed counts) for tools without a `skillsDir`.
 */
export async function generateSkillsForTool(
  root: string,
  tool: AiTool
): Promise<SkillSetupResult> {
  const result: SkillSetupResult = {
    tool,
    commands: { created: 0, updated: 0, unchanged: 0 },
    skills: { created: 0, updated: 0, unchanged: 0 },
  };
  if (!tool.skillsDir) return result;

  const style: CommandStyle = tool.commandStyle ?? 'namespaced';

  for (const template of WORKFLOW_TEMPLATES) {
    const cmdFile = path.join(root, commandPath(tool, template.id));
    const cmdOutcome = await writeIfChanged(cmdFile, renderCommand(template, style));
    result.commands[cmdOutcome] += 1;

    const skillFile = path.join(root, skillPath(tool, template.id));
    const skillOutcome = await writeIfChanged(skillFile, renderSkill(template, style));
    result.skills[skillOutcome] += 1;
  }

  return result;
}

/** Generates skills/commands for several tools in sequence. */
export async function generateSkills(
  root: string,
  tools: readonly AiTool[]
): Promise<SkillSetupResult[]> {
  const results: SkillSetupResult[] = [];
  for (const tool of tools) {
    if (tool.skillsDir) {
      results.push(await generateSkillsForTool(root, tool));
    }
  }
  return results;
}
