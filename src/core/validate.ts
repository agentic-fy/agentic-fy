import { readChange } from './change.js';
import { readArtifact, parseTasks, artifactTemplate } from './artifacts.js';
import { CHANGE_ARTIFACTS, ARTIFACT_FILES, ChangeArtifact } from './schema.js';

/**
 * Validação de artefatos de uma change.
 *
 * Reescrita enxuta da ideia do `validate` do projeto de referência (/base),
 * adaptada ao modelo do agentic (proposal/design/tasks), SEM o modelo de
 * deltas (## ADDED/MODIFIED Requirements), sem store/roots e sem dependências.
 *
 * O que a validação cobre — cada regra existe porque o `verify` atual não a
 * pega e ela representa um artefato que "parece pronto e não está":
 *  1. artefato ausente;
 *  2. artefato ainda idêntico ao template (ninguém escreveu nada);
 *  3. artefato praticamente vazio;
 *  4. tasks.md sem nenhum checkbox de verdade (só texto solto);
 *  5. (informativo) tarefas ainda pendentes.
 */

export type IssueLevel = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  level: IssueLevel;
  path: string;
  message: string;
}

export interface ValidationReport {
  change: string;
  valid: boolean;
  issues: ValidationIssue[];
  summary: { errors: number; warnings: number; info: number };
}

/** Normaliza markdown para comparação estrutural (ignora espaços/linhas em branco). */
function normalize(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
    .trim();
}

/** Conteúdo "real" do artefato: remove títulos, comentários e bullets vazios. */
function meaningfulBody(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith('#')) // headings do template
    .filter((l) => !/^<!--.*-->$/.test(l)) // comentários
    .filter((l) => !/^[-*]\s*$/.test(l)) // bullets vazios "- "
    .join('\n')
    .trim();
}

const MIN_BODY_LENGTH = 24;

/** Valida um único artefato de change, devolvendo issues. */
function validateArtifact(
  id: ChangeArtifact,
  changeName: string,
  content: string | null
): ValidationIssue[] {
  const file = ARTIFACT_FILES[id];
  if (content === null) {
    return [{ level: 'ERROR', path: file, message: `Artefato ausente: ${file}.` }];
  }

  const issues: ValidationIssue[] = [];

  // Idêntico ao template = ninguém preencheu.
  if (normalize(content) === normalize(artifactTemplate(id, changeName))) {
    issues.push({
      level: 'WARNING',
      path: file,
      message: `${file} ainda está com o conteúdo do template (não foi preenchido).`,
    });
    return issues; // não faz sentido acumular "quase vazio" por cima
  }

  // Corpo real muito curto.
  if (meaningfulBody(content).length < MIN_BODY_LENGTH) {
    issues.push({
      level: 'WARNING',
      path: file,
      message: `${file} está praticamente vazio; descreva o conteúdo real.`,
    });
  }

  return issues;
}

/** Valida o tasks.md além dos checks genéricos de artefato. */
function validateTasks(content: string | null): ValidationIssue[] {
  if (content === null) return []; // ausência já reportada em validateArtifact
  const issues: ValidationIssue[] = [];
  const tasks = parseTasks(content);

  if (tasks.length === 0) {
    // Há texto/bullets, mas nenhum checkbox: o verify contaria "0 tarefas" e
    // passaria batido. Espelha o alerta de checkbox do /base.
    const hasBullets = /^\s*[-*+]\s+\S/m.test(content);
    issues.push({
      level: 'ERROR',
      path: ARTIFACT_FILES.tasks,
      message: hasBullets
        ? 'tasks.md tem itens de lista, mas nenhum é checkbox. Escreva "- [ ] descrição".'
        : 'tasks.md não define nenhuma tarefa (checkbox "- [ ]").',
    });
    return issues;
  }

  const pending = tasks.filter((t) => !t.done).length;
  if (pending > 0) {
    issues.push({
      level: 'INFO',
      path: ARTIFACT_FILES.tasks,
      message: `${pending} de ${tasks.length} tarefa(s) ainda pendente(s).`,
    });
  }
  return issues;
}

/**
 * Valida uma change inteira. `strict` promove WARNING a fatal (afeta `valid`),
 * espelhando o `--strict` do /base.
 */
export async function validateChange(
  root: string,
  name: string,
  strict = false
): Promise<ValidationReport> {
  const change = await readChange(root, name); // lança se não existir
  const issues: ValidationIssue[] = [];

  const contents = new Map<ChangeArtifact, string | null>();
  for (const id of CHANGE_ARTIFACTS) {
    const content = await readArtifact(root, change.name, id);
    contents.set(id, content);
    issues.push(...validateArtifact(id, change.name, content));
  }

  issues.push(...validateTasks(contents.get('tasks') ?? null));

  const errors = issues.filter((i) => i.level === 'ERROR').length;
  const warnings = issues.filter((i) => i.level === 'WARNING').length;
  const info = issues.filter((i) => i.level === 'INFO').length;

  const valid = errors === 0 && (!strict || warnings === 0);

  return {
    change: change.name,
    valid,
    issues,
    summary: { errors, warnings, info },
  };
}
