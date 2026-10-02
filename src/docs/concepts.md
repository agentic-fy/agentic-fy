# Concepts

This is the long explanation of the ideas behind agentic-fy. For the one-page version, see [Core concepts](overview.md).

## The problem agentic-fy solves

When you work with an AI assistant, it's easy to ask for something vague and watch the AI confidently build the wrong thing. agentic-fy inserts a lightweight layer of agreement: you and the AI write and review a short plan before any code is written. The plan lives in the repository, next to the code, so it stays useful months later.

## Change

A **change** is the central unit of work. Whenever you want to add, modify, or remove behavior, you create a change with `agentic-fy propose <name>`. Each change is a folder under `agentic-fy/changes/<name>/` that gathers everything about that work:

```
agentic-fy/changes/add-dark-mode/
├── proposal.md                 # why and what
├── design.md                   # how
├── tasks.md                    # steps
├── specs/
│   └── add-dark-mode.delta.yaml  # how the requirements change (spec delta)
└── .agentic-fy.yaml            # metadata: name, status, dates
```

The name you pass is normalized into a disk-safe slug: `"Dark Mode Toggle"` becomes `dark-mode-toggle`.

## Artifacts

Each change contains a few kinds of artifact, created in a natural order where each one feeds the next:

| Artifact | Question it answers |
|----------|---------------------|
| `proposal.md` | Why do this, and what changes? |
| `specs/<capability>.delta.yaml` | How do the requirements change? (a structured spec delta) |
| `design.md` | How will it be built? |
| `tasks.md` | What are the concrete implementation steps? |

```
proposal ──► specs ──► design ──► tasks ──► implement
   why        what      how       steps       do
```

`propose` generates these files from templates. From there, you (or the AI) fill them with real content. `tasks.md` uses Markdown checkboxes (`- [ ]` / `- [x]`), which agentic-fy understands to track progress.

### Spec deltas, not rewritten specs

A change doesn't rewrite whole specs. It describes *how* it changes a capability through a structured YAML delta (`specs/<capability>.delta.yaml`), referencing requirements by a **stable id** with `add`, `modify`, and `remove` operations. The structure is schema-validated, so a malformed delta fails loudly instead of silently. On `merge` or `archive`, the delta is applied into the consolidated project spec at `agentic-fy/specs/<capability>.md`.

### Enablers, not gates

The order of the artifacts shows what becomes *possible* next, not what you are *required* to do. If, during implementation, you discover the design was wrong, edit `design.md` and move on. Nothing locks. The dependencies exist only to provide context — not to trap you in a waterfall process.

## Status and lifecycle

Each change carries a `status` in its `.agentic-fy.yaml`, moving through the workflow:

```
exploring ──► proposed ──► applying ──► converging ⇄ verified ──► archived
```

- **exploring** — initial state; set when you start a change with `explore <name>`.
- **proposed** — after `propose`, with the artifacts drafted.
- **applying** — after `apply`, while you implement the tasks.
- **converging** — after `verify` ran but something isn't proven yet (missing artifact, pending task, or failed/absent evidence). This is the verify → fix → verify loop.
- **verified** — after `verify` passes: all artifacts present, all tasks done, and every requirement's evidence proven (no gaps).
- **archived** — after `archive`, with the change moved to history.

The commands advance this status as you progress. `verify` only promotes to `verified` when the conditions are met; otherwise it sets `converging` and reports what's left.

## Evidence

A requirement in a spec delta can declare a `verify` command — a shell command that *proves* it (exit 0 = met). `agentic-fy verify` runs those commands and reports, per requirement, whether it passed, failed, or has no command. A change is only `verified` when nothing fails and there are no gaps.

Evidence is **command-only by design**: there is no self-declared "manual" pass. A requirement with no command is an honest, visible gap — you can accept it explicitly with `--allow-gaps`, but it is never silently counted as proven. This is what keeps an AI agent from marking a requirement done without an executable proof.

## Archiving

When the work is finished, `agentic-fy archive` merges the change's spec deltas into the consolidated project specs, then moves the change folder to `agentic-fy/changes/archive/<name>/` and marks the status as `archived`. The history is preserved there — plain Markdown that stays readable even without agentic-fy. That closes the loop and frees the workspace for the next change.

## The model: CLI + agent

An important, honest point: **agentic-fy does not contain an AI model.** It makes no calls to any LLM provider. The CLI is the tool that creates and tracks the artifacts and status; the intelligence that reads the design, writes the code, and checks the tasks comes from the **AI agent** that uses the tool.

There are two ways to use it:

1. **Manual (terminal).** You run the commands, edit the artifacts by hand, and implement the code yourself.
2. **Assisted (MCP).** You start `agentic-fy mcp` and connect an MCP-compatible assistant (such as Kiro). The agent then uses the `explore/propose/apply/verify/merge/archive` tools and drives the flow, writing the code and checking the tasks.

This design — CLI as the tool, agent as the brain — keeps agentic-fy lean, with no built-in LLM cost and no dependency on a specific provider. See [Commands](commands.md#mcp) to connect the MCP server to your editor.

## Project config

`agentic-fy.config.yaml`, created by `init`, holds the project's base configuration:

```yaml
version: 1
schema: spec-driven
workflow:
  - explore
  - propose
  - apply
  - verify
  - archive
```

It is read to resolve the project root (agentic-fy walks up the directory tree looking for this file) and to know the active workflow.

## Where to go next

- [Getting started](getting-started.md) — the first change end to end.
- [Core concepts](overview.md) — the mental model on one page.
- [Commands](commands.md) — reference for every command.
