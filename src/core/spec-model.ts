/**
 * Consolidated spec model + markdown (de)serialization.
 *
 * A "capability spec" is the durable, project-level description of what the
 * system does. It lives at `agentic-fy/specs/<capability>.md` as readable
 * markdown, but the merge engine works on this structured model. The pair
 * `parseSpec` / `renderSpec` is a stable round-trip: rendering a parsed spec
 * yields the same document.
 *
 * Each requirement carries a STABLE id (independent of its title), which is
 * what lets deltas reference requirements by id instead of by heading text —
 * the core improvement over a title-keyed model.
 *
 * Markdown shape:
 *
 *   # <capability>
 *
 *   ## Purpose
 *   <purpose prose>
 *
 *   ## Requirements
 *
 *   ### Requirement: <title> {#<id>}
 *   <statement>
 *
 *   #### Scenario:
 *   - WHEN <when>
 *   - THEN <then>
 */

export interface Scenario {
  when: string;
  then: string;
}

export interface Requirement {
  /** Stable identifier (kebab-case), independent of the title. */
  id: string;
  title: string;
  /** The normative statement (SHALL/MUST ...). */
  statement: string;
  scenarios: Scenario[];
}

export interface CapabilitySpec {
  /** Capability name (kebab-case); also the file stem under specs/. */
  capability: string;
  /** Short prose describing the capability. Empty string when unset. */
  purpose: string;
  requirements: Requirement[];
}

/** Creates an empty consolidated spec for a capability. */
export function emptySpec(capability: string): CapabilitySpec {
  return { capability, purpose: '', requirements: [] };
}

// ─── Render ──────────────────────────────────────────────────────────────────

/** Renders a consolidated spec as markdown (stable, round-trippable). */
export function renderSpec(spec: CapabilitySpec): string {
  const lines: string[] = [];
  lines.push(`# ${spec.capability}`);
  lines.push('');
  lines.push('## Purpose');
  lines.push(spec.purpose.trim() || 'TBD.');
  lines.push('');
  lines.push('## Requirements');

  for (const req of spec.requirements) {
    lines.push('');
    lines.push(`### Requirement: ${req.title} {#${req.id}}`);
    lines.push(req.statement.trim());
    for (const sc of req.scenarios) {
      lines.push('');
      lines.push('#### Scenario:');
      lines.push(`- WHEN ${sc.when.trim()}`);
      lines.push(`- THEN ${sc.then.trim()}`);
    }
  }

  return lines.join('\n') + '\n';
}

// ─── Parse ─────────────────────────────────────────────────────────────────────

const REQ_HEADER = /^###\s+Requirement:\s*(.*?)\s*(?:\{#([a-z0-9][a-z0-9-]*)\})?\s*$/;
const SCENARIO_HEADER = /^####\s+Scenario:/;
const WHEN_LINE = /^[-*]\s*WHEN\s+(.*)$/i;
const THEN_LINE = /^[-*]\s*THEN\s+(.*)$/i;

/** Slugifies a title into a fallback id when a header lacks an explicit `{#id}`. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parses a consolidated spec markdown document into the model.
 *
 * Tolerant by design: a requirement without an explicit `{#id}` gets an id
 * derived from its title, so hand-written specs still load. The capability is
 * taken from the `# ` title, falling back to `fallbackCapability`.
 */
export function parseSpec(content: string, fallbackCapability = ''): CapabilitySpec {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  let capability = fallbackCapability;
  let purpose = '';
  const requirements: Requirement[] = [];

  let section: 'none' | 'purpose' | 'requirements' = 'none';
  let current: Requirement | null = null;
  let scenario: Partial<Scenario> | null = null;
  const purposeLines: string[] = [];
  const statementLines: string[] = [];

  const flushScenario = () => {
    if (current && scenario && scenario.when != null && scenario.then != null) {
      current.scenarios.push({ when: scenario.when, then: scenario.then });
    }
    scenario = null;
  };
  const flushStatement = () => {
    if (current && statementLines.length > 0) {
      current.statement = statementLines.join('\n').trim();
      statementLines.length = 0;
    }
  };
  const flushRequirement = () => {
    flushScenario();
    flushStatement();
    if (current) requirements.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch && section === 'none' && !current) {
      capability = titleMatch[1].trim();
      continue;
    }

    if (/^##\s+Purpose\s*$/i.test(line)) {
      flushRequirement();
      section = 'purpose';
      continue;
    }
    if (/^##\s+Requirements\s*$/i.test(line)) {
      purpose = purposeLines.join('\n').trim();
      section = 'requirements';
      continue;
    }

    const reqMatch = line.match(REQ_HEADER);
    if (reqMatch && section === 'requirements') {
      flushRequirement();
      const title = reqMatch[1].trim();
      const id = reqMatch[2]?.trim() || slugify(title);
      current = { id, title, statement: '', scenarios: [] };
      continue;
    }

    if (SCENARIO_HEADER.test(line) && current) {
      flushScenario();
      flushStatement();
      scenario = {};
      continue;
    }

    if (scenario) {
      const w = line.match(WHEN_LINE);
      if (w) {
        scenario.when = w[1].trim();
        continue;
      }
      const t = line.match(THEN_LINE);
      if (t) {
        scenario.then = t[1].trim();
        continue;
      }
      // Non WHEN/THEN line inside a scenario: ignore (keeps parsing robust).
      continue;
    }

    if (section === 'purpose') {
      // Skip the TBD placeholder so a round-trip of an unset purpose stays empty.
      if (line.trim() && line.trim() !== 'TBD.') purposeLines.push(line);
      continue;
    }

    if (section === 'requirements' && current) {
      statementLines.push(line);
      continue;
    }
  }

  flushRequirement();
  if (section === 'purpose') purpose = purposeLines.join('\n').trim();

  return { capability, purpose, requirements };
}
