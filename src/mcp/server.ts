import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  runExplore,
  runPropose,
  runApply,
  runVerify,
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
 * Converte um WorkflowResult no formato de retorno de tool do MCP.
 */
function toToolResult(result: WorkflowResult) {
  const text = [
    `[${result.action}]${result.change ? ` ${result.change}` : ''}`,
    ...(result.status ? [`status: ${result.status}`] : []),
    ...result.messages,
  ].join('\n');
  return { content: [{ type: 'text' as const, text }] };
}

/** Empacota um texto simples no formato de retorno de tool do MCP. */
function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

/**
 * Resolve o nome de uma change existente ou lança com sugestão "did you mean".
 * Compartilhado pelas tools show/validate.
 */
async function resolveChangeName(root: string, name: string): Promise<string> {
  const names = (await listChanges(root)).map((c) => c.name);
  if (names.includes(name)) return name;
  const suggestions = nearestMatches(name, names);
  const hint = suggestions.length
    ? ` Você quis dizer: ${suggestions.join(', ')}?`
    : names.length
      ? ` Ativas: ${names.join(', ')}.`
      : '';
  throw new Error(`Change "${name}" não encontrada.${hint}`);
}

/** Renderiza um relatório de validação como texto legível para o agente. */
function renderReport(report: ValidationReport): string {
  const lines = [
    report.valid ? `✓ ${report.change} — válida` : `✗ ${report.change} — com problemas`,
  ];
  for (const issue of report.issues) {
    lines.push(`  [${issue.level}] ${issue.path}: ${issue.message}`);
  }
  return lines.join('\n');
}

/**
 * Cria o servidor MCP do agentic e registra uma tool por comando de workflow.
 * Cada tool delega à mesma função pura usada pelo CLI (core/workflow.ts),
 * evitando duplicação de lógica.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agentic',
    version: '0.1.0',
  });

  server.registerTool(
    'explore',
    {
      title: 'Explore',
      description: 'Mapeia o problema e entende a codebase (modo pensamento).',
      inputSchema: {},
    },
    async () => toToolResult(await runExplore())
  );

  server.registerTool(
    'propose',
    {
      title: 'Propose',
      description: 'Cria a change e rascunha proposal.md, specs/, design.md, tasks.md.',
      inputSchema: { nome: z.string().describe('Nome da change') },
    },
    async ({ nome }) => toToolResult(await runPropose(nome))
  );

  server.registerTool(
    'apply',
    {
      title: 'Apply',
      description: 'Implementa as tarefas de tasks.md.',
      inputSchema: { nome: z.string().optional().describe('Nome da change (opcional)') },
    },
    async ({ nome }) => toToolResult(await runApply(nome))
  );

  server.registerTool(
    'verify',
    {
      title: 'Verify',
      description: 'Verifica a implementação contra a spec.',
      inputSchema: { nome: z.string().optional().describe('Nome da change (opcional)') },
    },
    async ({ nome }) => toToolResult(await runVerify(nome))
  );

  server.registerTool(
    'archive',
    {
      title: 'Archive',
      description: 'Arquiva a change concluída.',
      inputSchema: { nome: z.string().optional().describe('Nome da change (opcional)') },
    },
    async ({ nome }) => toToolResult(await runArchive(nome))
  );

  server.registerTool(
    'list',
    {
      title: 'List',
      description: 'Lista as changes ativas com status, título e progresso de tarefas.',
      inputSchema: {},
    },
    async () => {
      const root = requireProjectRoot();
      const summaries = await listChangeSummaries(root);
      if (summaries.length === 0) {
        return textResult('Nenhuma change ativa. Use "propose <nome>" primeiro.');
      }
      const text = summaries
        .map(
          (s) =>
            `${s.name} (${s.status}): ${s.title} [tarefas ${s.tasks.completed}/${s.tasks.total}]`
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
        'Mostra uma change: resumo (status, título, artefatos, tarefas) ou o conteúdo de um artefato.',
      inputSchema: {
        nome: z.string().describe('Nome da change'),
        artefato: z
          .enum(CHANGE_ARTIFACTS)
          .optional()
          .describe('Opcional: retorna o conteúdo cru do artefato (proposal|design|tasks)'),
      },
    },
    async ({ nome, artefato }) => {
      const root = requireProjectRoot();
      const changeName = await resolveChangeName(root, nome);
      if (artefato) {
        return textResult(await readChangeArtifact(root, changeName, artefato as ChangeArtifact));
      }
      const d = await showChange(root, changeName);
      const artifacts = d.artifacts
        .map((a) => `  ${a.exists ? '✓' : '✗'} ${a.file}`)
        .join('\n');
      const text = [
        `${d.name} (${d.status})`,
        `Título: ${d.title}`,
        `Tarefas: ${d.tasks.completed}/${d.tasks.total} concluídas`,
        'Artefatos:',
        artifacts,
        ...(d.specs.length ? [`Specs da change: ${d.specs.join(', ')}`] : []),
      ].join('\n');
      return textResult(text);
    }
  );

  server.registerTool(
    'validate',
    {
      title: 'Validate',
      description:
        'Valida os artefatos de uma change (ou de todas): artefato ausente, template intocado, tasks sem checkbox.',
      inputSchema: {
        nome: z.string().optional().describe('Nome da change (omita para usar --all quando houver uma só)'),
        todas: z.boolean().optional().describe('Valida todas as changes ativas'),
        strict: z.boolean().optional().describe('Trata avisos (WARNING) como falha'),
      },
    },
    async ({ nome, todas, strict }) => {
      const root = requireProjectRoot();
      let targets: string[];
      if (todas) {
        targets = (await listChanges(root)).map((c) => c.name).sort();
      } else if (nome) {
        targets = [await resolveChangeName(root, nome)];
      } else {
        const active = await listChanges(root);
        if (active.length === 1) targets = [active[0].name];
        else if (active.length === 0) throw new Error('Nenhuma change ativa. Use "propose <nome>".');
        else
          throw new Error(
            `Há várias changes ativas (${active.map((c) => c.name).join(', ')}). Informe o nome ou use todas=true.`
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
      description: 'Panorama das changes ativas: estágio, progresso de tarefas e problemas.',
      inputSchema: {},
    },
    async () => {
      const root = requireProjectRoot();
      const status = await projectStatus(root);
      if (status.total === 0) return textResult('Nenhuma change ativa.');
      const lines = [
        `Changes ativas: ${status.total}`,
        ...status.changes.map(
          (c) =>
            `- ${c.name} (${c.status}): tarefas ${c.tasks.completed}/${c.tasks.total}, ` +
            `${c.errors} erro(s), ${c.warnings} aviso(s)`
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
        'Reúne o contexto do projeto (config, changes ativas e specs) num brief para o agente.',
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
 * Sobe o servidor MCP via stdio. Bloqueia enquanto o transporte estiver aberto.
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
