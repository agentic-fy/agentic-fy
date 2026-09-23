import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  runExplore,
  runPropose,
  runApply,
  runVerify,
  runMerge,
  runArchive,
  type WorkflowResult,
} from '../core/workflow.js';
import { requireProjectRoot, listChanges } from '../core/change.js';
import { listChangeSummaries, showChange, readChangeArtifact } from '../core/inspect.js';
import { validateChange, type ValidationReport } from '../core/validate.js';
import { projectStatus } from '../core/status.js';
import { projectContext, renderContext } from '../core/context.js';
import { nearestMatches } from '../core/match.js';
import { CHANGE_ARTIFACTS, type ChangeArtifact } from '../core/schema.js';

/**
 * Converts a WorkflowResult into the MCP tool return format.
 */
function toToolResult(result: WorkflowResult) {
  const text = [
    `[${result.action}]${result.change ? ` ${result.change}` : ''}`,
    ...(result.status ? [`status: ${result.status}`] : []),
    ...result.messages,
  ].join('\n');
  return { content: [{ type: 'text' as const, text }] };
}

/** Wraps plain text in the MCP tool return format. */
function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/**
 * Resolves the name of an existing change or throws with a "did you mean" suggestion.
 * Shared by the show/validate tools.
 */
async function resolveChangeName(root: string, name: string): Promise<string> {
  const names = (await listChanges(root)).map((c) => c.name);
  if (names.includes(name)) return name;
  const suggestions = nearestMatches(name, names);
  const hint = suggestions.length
    ? ` Did you mean: ${suggestions.join(', ')}?`
    : names.length
      ? ` Active: ${names.join(', ')}.`
      : '';
  throw new Error(`Change "${name}" not found.${hint}`);
}

/** Renders a validation report as readable text for the agent. */
function renderReport(report: ValidationReport): string {
  const lines = [
    report.valid ? `✓ ${report.change} — valid` : `✗ ${report.change} — has issues`,
  ];
  for (const issue of report.issues) {
    lines.push(`  [${issue.level}] ${issue.path}: ${issue.message}`);
  }
  return lines.join('\n');
}

/**
 * Creates the agentic-fy MCP server and registers one tool per workflow command.
 * Each tool delegates to the same pure function used by the CLI (core/workflow.ts),
 * avoiding logic duplication.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agentic-fy',
    version: '0.1.2',
  });

  server.registerTool(
    'explore',
    {
      title: 'Explore',
      description: 'Maps the problem and understands the codebase (thinking mode).',
      inputSchema: {},
    },
    async () => toToolResult(await runExplore())
  );

  server.registerTool(
    'propose',
    {
      title: 'Propose',
      description: 'Creates the change and drafts proposal.md, specs/, design.md, tasks.md.',
      inputSchema: { name: z.string().describe('Change name') },
    },
    async ({ name }) => toToolResult(await runPropose(name))
  );

  server.registerTool(
    'apply',
    {
      title: 'Apply',
      description: 'Implements the tasks in tasks.md.',
      inputSchema: { name: z.string().optional().describe('Change name (optional)') },
    },
    async ({ name }) => toToolResult(await runApply(name))
  );

  server.registerTool(
    'verify',
    {
      title: 'Verify',
      description: 'Verifies the implementation against the spec.',
      inputSchema: { name: z.string().optional().describe('Change name (optional)') },
    },
    async ({ name }) => toToolResult(await runVerify(name))
  );

  server.registerTool(
    'archive',
    {
      title: 'Archive',
      description: 'Archives the completed change.',
      inputSchema: { name: z.string().optional().describe('Change name (optional)') },
    },
    async ({ name }) => toToolResult(await runArchive(name))
  );

  server.registerTool(
    'merge',
    {
      title: 'Merge',
      description:
        'Applies the change spec deltas into the project specs without archiving (early-sync).',
      inputSchema: { name: z.string().optional().describe('Change name (optional)') },
    },
    async ({ name }) => toToolResult(await runMerge(name))
  );

  server.registerTool(
    'list',
    {
      title: 'List',
      description: 'Lists the active changes with status, title, and task progress.',
      inputSchema: {},
    },
    async () => {
      const root = requireProjectRoot();
      const summaries = await listChangeSummaries(root);
      if (summaries.length === 0) {
        return textResult('No active changes. Use "propose <name>" first.');
      }
      const text = summaries
        .map(
          (s) =>
            `${s.name} (${s.status}): ${s.title} [tasks ${s.tasks.completed}/${s.tasks.total}]`
        )
        .join('\n');
      return textResult(text);
    }
  );

  server.registerTool(
    'show',
    {
      title: 'Show',
      description:
        'Shows a change: summary (status, title, artifacts, tasks) or the content of an artifact.',
      inputSchema: {
        name: z.string().describe('Change name'),
        artifact: z
          .enum(CHANGE_ARTIFACTS)
          .optional()
          .describe('Optional: returns the raw content of the artifact (proposal|design|tasks)'),
      },
    },
    async ({ name, artifact }) => {
      const root = requireProjectRoot();
      const changeName = await resolveChangeName(root, name);
      if (artifact) {
        return textResult(await readChangeArtifact(root, changeName, artifact as ChangeArtifact));
      }
      const d = await showChange(root, changeName);
      const artifacts = d.artifacts
        .map((a) => `  ${a.exists ? '✓' : '✗'} ${a.file}`)
        .join('\n');
      const text = [
        `${d.name} (${d.status})`,
        `Title: ${d.title}`,
        `Tasks: ${d.tasks.completed}/${d.tasks.total} completed`,
        'Artifacts:',
        artifacts,
        ...(d.specs.length ? [`Change specs: ${d.specs.join(', ')}`] : []),
      ].join('\n');
      return textResult(text);
    }
  );

  server.registerTool(
    'validate',
    {
      title: 'Validate',
      description:
        'Validates the artifacts of a change (or of all): missing artifact, untouched template, tasks without a checkbox.',
      inputSchema: {
        name: z.string().optional().describe('Change name (omit to use --all when there is only one)'),
        all: z.boolean().optional().describe('Validates all active changes'),
        strict: z.boolean().optional().describe('Treats warnings (WARNING) as failures'),
      },
    },
    async ({ name, all, strict }) => {
      const root = requireProjectRoot();
      let targets: string[];
      if (all) {
        targets = (await listChanges(root)).map((c) => c.name).sort();
      } else if (name) {
        targets = [await resolveChangeName(root, name)];
      } else {
        const active = await listChanges(root);
        if (active.length === 1) targets = [active[0].name];
        else if (active.length === 0) throw new Error('No active changes. Use "propose <name>".');
        else
          throw new Error(
            `There are multiple active changes (${active.map((c) => c.name).join(', ')}). Provide the name or use all=true.`
          );
      }
      const reports = await Promise.all(targets.map((t) => validateChange(root, t, strict)));
      return textResult(reports.map(renderReport).join('\n\n'));
    }
  );

  server.registerTool(
    'status',
    {
      title: 'Status',
      description: 'Overview of active changes: stage, task progress, and issues.',
      inputSchema: {},
    },
    async () => {
      const root = requireProjectRoot();
      const status = await projectStatus(root);
      if (status.total === 0) return textResult('No active changes.');
      const lines = [
        `Active changes: ${status.total}`,
        ...status.changes.map(
          (c) =>
            `- ${c.name} (${c.status}): tasks ${c.tasks.completed}/${c.tasks.total}, ` +
            `${c.errors} error(s), ${c.warnings} warning(s)`
        ),
      ];
      return textResult(lines.join('\n'));
    }
  );

  server.registerTool(
    'context',
    {
      title: 'Context',
      description:
        'Gathers the project context (config, active changes, and specs) into a brief for the agent.',
      inputSchema: {},
    },
    async () => {
      const root = requireProjectRoot();
      return textResult(renderContext(await projectContext(root)));
    }
  );

  return server;
}

/**
 * Starts the MCP server over stdio. Blocks while the transport is open.
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
