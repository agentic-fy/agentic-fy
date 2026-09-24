import { z } from 'zod';
import YAML from 'yaml';

/**
 * Structured spec delta (YAML).
 *
 * A change describes how it modifies a capability's consolidated spec through a
 * YAML delta file (`<capability>.delta.yaml`) instead of free-form markdown.
 * The structure is validated by a schema, so a malformed delta fails loudly and
 * explicitly — never silently, which is the main weakness of a markdown-parsed
 * delta model.
 *
 * Operations reference requirements by their STABLE `id`:
 *  - add:    introduce a new requirement.
 *  - modify: patch an existing one (title/statement and/or scenarios) — partial,
 *            so you never recopy the whole requirement.
 *  - remove: delete a requirement (rename is just a `modify` of the title).
 */

const idSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be kebab-case (a-z, 0-9, dashes)');

const scenarioSchema = z.object({
  when: z.string().min(1, 'scenario.when cannot be empty'),
  then: z.string().min(1, 'scenario.then cannot be empty'),
});

const addOpSchema = z.object({
  op: z.literal('add'),
  id: idSchema,
  title: z.string().min(1, 'add.title cannot be empty'),
  statement: z.string().min(1, 'add.statement cannot be empty'),
  /** Optional shell command that proves the requirement (exit 0 = met). */
  verify: z.string().min(1).optional(),
  scenarios: z.array(scenarioSchema).default([]),
});

const modifyOpSchema = z.object({
  op: z.literal('modify'),
  id: idSchema,
  set: z
    .object({
      title: z.string().min(1).optional(),
      statement: z.string().min(1).optional(),
      /** Set/replace the evidence command. */
      verify: z.string().min(1).optional(),
    })
    .optional(),
  addScenarios: z.array(scenarioSchema).optional(),
  removeScenarios: z.array(z.string().min(1)).optional(),
});

const removeOpSchema = z.object({
  op: z.literal('remove'),
  id: idSchema,
  reason: z.string().optional(),
});

export const specOperationSchema = z.discriminatedUnion('op', [
  addOpSchema,
  modifyOpSchema,
  removeOpSchema,
]);

export const specDeltaSchema = z.object({
  capability: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9/-]*$/, 'capability must be kebab-case (slashes allowed for nesting)'),
  /** Optional purpose; only seeds a brand-new capability spec. */
  purpose: z.string().optional(),
  operations: z.array(specOperationSchema).min(1, 'a delta needs at least one operation'),
});

export type SpecOperation = z.infer<typeof specOperationSchema>;
export type SpecDelta = z.infer<typeof specDeltaSchema>;

/**
 * Parses and validates a YAML delta document. Throws with a readable message
 * when the YAML is malformed or the structure fails the schema.
 */
export function parseSpecDelta(content: string, sourceLabel = 'delta'): SpecDelta {
  let raw: unknown;
  try {
    raw = YAML.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML in ${sourceLabel}: ${message}`);
  }

  const result = specDeltaSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid spec delta in ${sourceLabel}:\n${issues}`);
  }

  // A `modify` that changes nothing is almost certainly a mistake; reject it
  // with a clear message (kept out of the schema so the discriminated union
  // stays a plain object union).
  for (const op of result.data.operations) {
    if (
      op.op === 'modify' &&
      op.set === undefined &&
      (op.addScenarios?.length ?? 0) === 0 &&
      (op.removeScenarios?.length ?? 0) === 0
    ) {
      throw new Error(
        `Invalid spec delta in ${sourceLabel}: modify "${op.id}" changes nothing ` +
          `(provide set, addScenarios, or removeScenarios).`
      );
    }
  }

  return result.data;
}

/** A ready-to-fill delta template written by `propose`. */
export function specDeltaTemplate(capability: string): string {
  return `# Spec delta for the "${capability}" capability.
# Reference requirements by their stable id. Operations: add | modify | remove.
capability: ${capability}

# Only needed when this delta introduces a brand-new capability:
# purpose: What this capability is for.

operations:
  - op: add
    id: example-requirement
    title: Example requirement
    statement: The system SHALL do something observable.
    # Optional: a shell command that PROVES this requirement (exit 0 = met).
    # Without it, the requirement shows as an honest gap in "verify"/"view".
    verify: npm test -- example
    scenarios:
      - when: a user does X
        then: the system does Y

  # - op: modify
  #     id: example-requirement
  #     set:
  #       statement: The system SHALL do something better.
  #       verify: npm test -- example-better
  #     addScenarios:
  #       - when: a user does Z
  #         then: the system does W

  # - op: remove
  #     id: obsolete-requirement
  #     reason: Replaced by example-requirement
`;
}
