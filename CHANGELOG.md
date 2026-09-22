# Changelog

All notable changes to this project are documented here.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to semantic versioning ([SemVer](https://semver.org/)).

## [0.1.3] - 2026-09-22

Per-tool slash commands and skills. Beyond the MCP integration, `init` now
writes markdown command and skill files into the repo so AI tools (Claude Code,
Cursor, Kiro, GitHub Copilot, Windsurf) register agentic-fy commands and
auto-invocable skills. Non-destructive and idempotent, with no new dependencies.

### Added

- **Slash commands & skills generation**
  - `init` now generates, for each selected tool that reads them, the workflow
    commands (`explore`, `propose`, `apply`, `verify`, `archive`) as files:
    - commands at `<tool>/commands/agentic-fy/<id>.md` (namespaced tools, e.g.
      Claude Code -> `/agentic-fy:propose`) or `<tool>/commands/agentic-fy-<id>.md`
      (flat tools, e.g. Cursor -> `/agentic-fy-propose`);
    - skills at `<tool>/skills/agentic-fy-<id>/SKILL.md`, each with `name`,
      `description`, and `allowed-tools` frontmatter.
  - Command/skill bodies guide the agent through the loop and hand off to the
    next step; the command invocation form is rewritten per tool.
  - Generation is non-destructive and idempotent: files are only written when
    their content changes, so re-running `init` and manual edits are preserved.

### Changed

- `init` now reports a "Commands & skills" section alongside the MCP setup,
  listing how many command and skill files were written per tool.
- The tool catalog carries the skill/command surface per tool (`skillsDir` and
  the namespaced/flat invocation style).

## [0.1.2] - 2026-09-21

CLI consolidation: beyond the workflow loop, agentic-fy now inspects,
validates, and visualizes the project, and integrates AI tools via MCP during
`init`. Everything rewritten in a lean way, with no new dependencies.

### Added

- **Inspection**
  - `list` — lists active changes (`--specs`, `--long`, `--json`).
  - `show <name>` — shows a change, an artifact (`--artifact`), or a spec
    (`--spec`); suggests close names when the name doesn't match ("did you mean?").
  - `status` — overview of changes by stage, with progress and issues.
  - `context` — gathers config, changes, and specs into a brief for the agent.
  - `view` — specs and changes dashboard, interactive in the terminal (navigation
    by number via native readline) and with a `--static`/`--json` mode.
- **Validation and integrity**
  - `validate [name]` — validates the artifacts of a change (`--all`, `--strict`,
    `--json`): detects missing artifacts, untouched templates, empty bodies, and
    `tasks.md` without a real checkbox.
  - `doctor` — project integrity check (config, change metadata,
    orphaned directories, consistent artifacts).
- **Configuration**
  - `config show` / `config set` — reads and edits `agentic-fy.config.yaml`, validating
    against the schema before writing.
- **AI tool integration in `init`**
  - Interactive tool selection (with detected tools pre-selected) and the
    `--tools all|none|<list>` flag for non-interactive mode.
  - **Non-destructive and idempotent** generation/merge of each tool's `mcp.json`
    (Kiro, Cursor, GitHub Copilot, Claude Code, Windsurf), pointing to
    `agentic-fy mcp`.
- **Autocompletion**
  - `completion [shell]` — prints an autocompletion script for PowerShell,
    Bash, or Zsh, without installing anything automatically.
- **MCP**
  - New tools exposed by the MCP server: `list`, `show`, `validate`,
    `status`, and `context` (in addition to the workflow ones).

### Changed

- `init` no longer only creates the base structure: it now also configures the
  MCP integration for the chosen tools (keeping idempotency).
- Documentation (`docs/commands.md` and `docs/getting-started.md`) updated to
  cover all commands and the MCP integration.

### Kept lean (out of scope by design)

Features from the reference project that were **not** brought in, to preserve the
minimalist proposal: multi-repository planning (stores/worksets),
profiles, migration/legacy, telemetry, and the structured spec deltas model.

## [0.1.1] - 2026-09

- Core of the spec-driven workflow: `init`, `explore`, `propose`, `apply`,
  `verify`, `archive`.
- MCP server (`mcp`) exposing the workflow tools via stdio.
- Base project structure (`agentic-fy.config.yaml` + `agentic-fy/`).

[0.1.3]: #013---2026-09-22
[0.1.2]: #012---2026-09-21
[0.1.1]: #011---2026-09
