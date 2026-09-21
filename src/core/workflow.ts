import {
  requireProjectRoot,
  createChange,
  readChange,
  setChangeStatus,
  listChanges,
  archiveChange,
} from './change.js';
import {
  artifactStates,
  writeArtifact,
  writeSpec,
  artifactTemplate,
  specTemplate,
  readArtifact,
  parseTasks,
} from './artifacts.js';
import { CHANGE_ARTIFACTS } from './schema.js';

/**
 * Funções puras do workflow. São o núcleo compartilhado: tanto os handlers
 * do CLI quanto as tools MCP delegam aqui, evitando duplicação de lógica.
 * Cada função retorna um resultado estruturado; a formatação fica na camada
 * de apresentação (CLI ou MCP).
 */

export interface WorkflowResult {
  action: string;
  change?: string;
  status?: string;
  messages: string[];
}

// ─── explore ─────────────────────────────────────────────────────────────────

export async function runExplore(cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const list = await listChanges(root);
  const messages = [
    'Modo explore: mapeie o problema e a codebase (não implementa).',
    'Quando estiver pronto, use "propose <nome>" para capturar a mudança.',
    list.length > 0
      ? `Changes ativas: ${list.map((c) => `${c.name} (${c.metadata.status})`).join(', ')}`
      : 'Nenhuma change ativa ainda.',
  ];
  return { action: 'explore', messages };
}

// ─── propose ─────────────────────────────────────────────────────────────────

export async function runPropose(name: string, cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const existed = false; // createChange é idempotente; registramos o que foi criado
  const change = await createChange(root, name, 'proposed');
  const messages: string[] = [];

  // Rascunha os artefatos (proposal, design, tasks) sem sobrescrever existentes.
  for (const id of CHANGE_ARTIFACTS) {
    const res = await writeArtifact(root, change.name, id, artifactTemplate(id, change.name));
    messages.push(res.written ? `Criado: ${id}.md` : `Mantido: ${id}.md (já existia)`);
  }

  // Rascunha um spec inicial.
  const spec = await writeSpec(root, change.name, 'spec.md', specTemplate(change.name));
  messages.push(spec.written ? 'Criado: specs/spec.md' : 'Mantido: specs/spec.md (já existia)');

  await setChangeStatus(root, change.name, 'proposed');

  void existed;
  return { action: 'propose', change: change.name, status: 'proposed', messages };
}

// ─── apply ───────────────────────────────────────────────────────────────────

export async function runApply(name: string | undefined, cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const changeName = await resolveSingleChange(root, name);
  const change = await readChange(root, changeName);

  const tasksContent = await readArtifact(root, change.name, 'tasks');
  if (tasksContent === null) {
    throw new Error(
      `A change "${change.name}" não tem tasks.md. Rode "propose ${change.name}" primeiro.`
    );
  }

  const tasks = parseTasks(tasksContent);
  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  await setChangeStatus(root, change.name, 'applying');

  const messages = [
    `Aplicando a change "${change.name}".`,
    `Tarefas: ${done.length} concluídas, ${pending.length} pendentes.`,
    ...pending.map((t) => `  [ ] ${t.text}`),
    'Implemente as tarefas na ordem, mantendo alinhamento com design.md e specs/.',
  ];
  return { action: 'apply', change: change.name, status: 'applying', messages };
}

// ─── verify ──────────────────────────────────────────────────────────────────

export async function runVerify(name: string | undefined, cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const changeName = await resolveSingleChange(root, name);
  const change = await readChange(root, changeName);

  const states = artifactStates(root, change.name);
  const missing = states.filter((s) => !s.exists);

  const tasksContent = await readArtifact(root, change.name, 'tasks');
  const tasks = tasksContent ? parseTasks(tasksContent) : [];
  const pending = tasks.filter((t) => !t.done);

  const messages: string[] = [];
  messages.push(`Verificando a change "${change.name}".`);
  if (missing.length > 0) {
    messages.push(`Artefatos faltando: ${missing.map((m) => m.file).join(', ')}`);
  } else {
    messages.push('Todos os artefatos presentes (proposal, design, tasks).');
  }
  if (pending.length > 0) {
    messages.push(`Tarefas pendentes: ${pending.length}.`);
  } else if (tasks.length > 0) {
    messages.push('Todas as tarefas marcadas como concluídas.');
  }

  const ok = missing.length === 0 && pending.length === 0 && tasks.length > 0;
  if (ok) {
    await setChangeStatus(root, change.name, 'verified');
    messages.push('Status atualizado para "verified".');
  } else {
    messages.push('Ainda não pronto para arquivar; resolva os pontos acima.');
  }

  return { action: 'verify', change: change.name, status: ok ? 'verified' : change.metadata.status, messages };
}

// ─── archive ─────────────────────────────────────────────────────────────────

export async function runArchive(name: string | undefined, cwd = process.cwd()): Promise<WorkflowResult> {
  const root = requireProjectRoot(cwd);
  const changeName = await resolveSingleChange(root, name);
  const dest = await archiveChange(root, changeName);
  return {
    action: 'archive',
    change: changeName,
    status: 'archived',
    messages: [`Change "${changeName}" arquivada em ${dest}.`],
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve o nome da change: usa o informado, ou a única ativa se houver
 * exatamente uma. Caso contrário, orienta o usuário a especificar.
 */
async function resolveSingleChange(root: string, name?: string): Promise<string> {
  if (name) {
    // readChange/archiveChange fazem a validação final do nome.
    return name;
  }
  const list = await listChanges(root);
  if (list.length === 1) {
    return list[0].name;
  }
  if (list.length === 0) {
    throw new Error('Nenhuma change ativa. Rode "propose <nome>" primeiro.');
  }
  throw new Error(
    `Há várias changes ativas (${list.map((c) => c.name).join(', ')}). ` +
      `Especifique o nome: use "<comando> <nome>".`
  );
}
