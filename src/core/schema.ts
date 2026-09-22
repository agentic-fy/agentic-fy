import { z } from 'zod';

/**
 * Possible statuses of a change throughout the workflow
 * explore -> propose -> apply -> verify -> archive.
 */
export const CHANGE_STATUSES = [
  'exploring',
  'proposed',
  'applying',
  'verified',
  'archived',
] as const;

export const ChangeStatusSchema = z.enum(CHANGE_STATUSES);
export type ChangeStatus = z.infer<typeof ChangeStatusSchema>;

/**
 * Metadata persisted in `agentic-fy/changes/<name>/.agentic-fy.yaml`.
 */
export const ChangeMetadataSchema = z.object({
  name: z.string().min(1, 'name cannot be empty'),
  status: ChangeStatusSchema.default('exploring'),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
});
export type ChangeMetadata = z.infer<typeof ChangeMetadataSchema>;

/**
 * Base project config (`agentic-fy.config.yaml`), created by `init`.
 */
export const ProjectConfigSchema = z.object({
  version: z.number().int().positive().default(1),
  schema: z.string().default('spec-driven'),
  workflow: z
    .array(z.enum(['explore', 'propose', 'apply', 'verify', 'archive']))
    .default(['explore', 'propose', 'apply', 'verify', 'archive']),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  version: 1,
  schema: 'spec-driven',
  workflow: ['explore', 'propose', 'apply', 'verify', 'archive'],
};

/**
 * Artifacts that make up a spec-driven change.
 */
export const CHANGE_ARTIFACTS = ['proposal', 'design', 'tasks'] as const;
export type ChangeArtifact = (typeof CHANGE_ARTIFACTS)[number];

/** Maps the artifact id to the on-disk file within the change. */
export const ARTIFACT_FILES: Record<ChangeArtifact, string> = {
  proposal: 'proposal.md',
  design: 'design.md',
  tasks: 'tasks.md',
};
