# Agentic-Fy

<p align="center">
  <a href="https://www.npmjs.com/package/@agentic-fy/agentic-fy"><img alt="npm version" src="https://img.shields.io/npm/v/@agentic-fy/agentic-fy?style=flat-square" /></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" /></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20.19-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img alt="MCP" src="https://img.shields.io/badge/MCP-ready-a855f7?style=flat-square" />
</p>

A performant, lean TypeScript CLI for **spec-driven** workflows, with **MCP** support.

agentic-fy structures the spec-driven development cycle — from draft to archive — and exposes that flow both in the terminal and as an MCP server, so an AI agent can drive the work inside your IDE.

## Why agentic-fy

- **Lean.** Few dependencies, no ceremony. Easy to understand and extend.
- **MCP-first.** Integrates with your editor via the Model Context Protocol, and also generates slash commands / skills for the tools that read them.
- **Spec-driven.** Every change starts from clear artifacts: proposal, design, tasks, and a structured spec delta.
- **Verifiable.** Requirements can carry a command that *proves* them — `verify` runs it, so a change is only done when there is executable evidence, not just a checked box.

## Requirements

- Node.js `>= 20.19.0`

## Installation

```bash
npm install -g @agentic-fy/agentic-fy
```

Or run without installing:

```bash
npx @agentic-fy/agentic-fy --version
```

## Quick start

```bash
cd your-project
agentic-fy init                    # creates the structure and integrates your IDE (MCP)
agentic-fy explore                 # (optional) think before coding
agentic-fy propose "dark mode"     # drafts proposal, design, tasks, and a spec delta
agentic-fy apply                   # tracks the tasks
agentic-fy verify                  # runs evidence; loops until everything is proven
agentic-fy archive                 # merges the spec deltas and archives the change
```

## What `init` creates

```
agentic-fy.config.yaml   # project configuration
agentic-fy/
├── specs/               # consolidated project specs (one file per capability)
├── changes/             # proposed changes (one folder per change)
│   └── archive/         # completed changes
```

`init` is idempotent and also configures the editor integration. In the terminal it opens an interactive multi-select (arrows + space); to skip the prompt use `--tools`:

```bash
agentic-fy init --tools claude,cursor   # configures the chosen tools
agentic-fy init --tools all             # all supported tools
agentic-fy init --tools none            # only the base structure
```

The config merge is non-destructive and idempotent: an existing `mcp.json` keeps its other servers; agentic-fy only adds (or updates) its own entry.

## Supported tools

`init` configures the MCP server and generates slash commands / skills for:

| Tool | MCP config | Commands |
|---|---|---|
| Kiro | `.kiro/settings/mcp.json` | `/agentic-fy:<cmd>` |
| Cursor | `.cursor/mcp.json` | `/agentic-fy-<cmd>` |
| GitHub Copilot (VS Code) | `.vscode/mcp.json` | `/agentic-fy-<cmd>` |
| Claude Code | `.mcp.json` | `/agentic-fy:<cmd>` |
| Windsurf | `.windsurf/mcp.json` | `/agentic-fy:<cmd>` |
| OpenCode | `opencode.json` (`mcp` key) | `/agentic-fy-<cmd>` |
| Kimi Code | `.kimi-code/mcp.json` | `/agentic-fy-<cmd>` |
| Zed | `.zed/settings.json` (`context_servers` key) | `/agentic-fy-<cmd>` |

Any other MCP-compatible client can connect manually to `agentic-fy mcp`.

## Commands

| Command | What it does |
|---|---|
| `init [path] [--tools <list>]` | Creates the base structure and integrates the AI tools (MCP + commands/skills) |
| `explore [name]` | Thinking mode: maps the problem; with a name, starts the change as `exploring` |
| `propose <name>` | Creates the change and drafts `proposal`, `design`, `tasks`, and a spec delta |
| `apply [name]` | Reads `tasks.md` and reports task progress |
| `verify [name] [--allow-gaps]` | Runs each requirement's evidence command; moves the change to `verified` or `converging` |
| `merge [name] [--dry-run]` | Applies the change's spec deltas to the project specs, keeping the change active (early-sync) |
| `archive [name] [--dry-run]` | Applies the spec deltas to the project specs, then archives the change |
| `list [--specs] [--long] [--json]` | Lists changes (or specs) |
| `show <name> [--artifact\|--spec] [--json]` | Shows a change, an artifact, or a spec |
| `validate [name] [--all] [--strict] [--json]` | Validates artifacts and the YAML spec deltas of a change |
| `status [--json]` | Overview of changes by stage, progress, and issues |
| `config show \| set <key> <value>` | Reads and edits `agentic-fy.config.yaml` |
| `doctor [--json]` | Checks project integrity |
| `context [--json]` | Gathers config, changes, and specs into a brief for the agent |
| `view [--static] [--json]` | Specs and changes dashboard (interactive in the terminal) |
| `completion [shell]` | Prints an autocompletion script (powershell/bash/zsh) |
| `ticket [--print]` | Opens the GitHub "new issue" page (bug report / feature request) |
| `mcp` | Starts the MCP server (stdio) |

Full reference in [`docs/commands.html`](docs/commands.html).

## The artifacts of a change

When you run `propose`, the change gets:

| Artifact | Purpose |
|----------|---------|
| `proposal.md` | The "why" and the "what" — intent, scope, and approach |
| `specs/<capability>.delta.yaml` | Spec delta: how the requirements change (merged into the project specs on archive) |
| `design.md` | The "how" — technical approach and decisions |
| `tasks.md` | Implementation checklist (Markdown checkboxes) |

### Spec deltas (YAML)

A change doesn't rewrite whole specs — it describes how it changes a capability, referencing requirements by a **stable id**:

```yaml
capability: data-export
operations:
  - op: add
    id: user-can-export-data
    title: User can export data
    statement: The system SHALL let users export their data as CSV.
    verify: npm test -- export     # optional: a command that proves this requirement
    scenarios:
      - when: the user clicks Export
        then: a CSV file is downloaded
  - op: modify
    id: user-can-export-data
    set:
      statement: The system SHALL let users export as CSV or JSON.
    addScenarios:
      - when: the user selects JSON
        then: a JSON file is downloaded
  - op: remove
    id: legacy-export
```

The structure is validated by a schema (malformed deltas fail loudly, never silently). On `archive` (or `merge`), the deltas are applied into the consolidated spec at `agentic-fy/specs/<capability>.md`.

### Evidence and the convergence loop

If a requirement declares a `verify` command, `agentic-fy verify` runs it (exit 0 = proven). The change is only marked `verified` when every requirement is proven and there are no gaps. Otherwise it enters a `converging` state and `verify` reports an actionable plan:

```
Evidence: 1/2 requirement(s) proven.
  ✓ user-can-export-data  (npm test -- export)
  ✗ export-is-async  FAILED: npm test -- async — exit 1  → fix the implementation, then run verify again

Converging — not ready yet: 1 failed evidence.
```

Evidence is command-only by design: a requirement with no command is an honest, visible gap (use `--allow-gaps` to accept it) — never a self-declared pass.

## Letting the AI drive (MCP)

If you chose a tool during `init`, your editor's MCP config has already been written — just reload the editor. To start the server manually:

```bash
agentic-fy mcp
```

It exposes the `explore`, `propose`, `apply`, `verify`, `merge`, `archive`, `list`, `show`, `validate`, `status`, `context`, `doctor`, and `config` tools to any MCP-compatible agent. Per-editor setup in [`docs/commands.html`](docs/commands.html).

## Language

agentic-fy is written in **TypeScript** (ESM, Node `>= 20.19`) and ships compiled JavaScript in `dist/`. Runtime dependencies are kept minimal: `@modelcontextprotocol/sdk`, `commander`, `chalk`, `yaml`, and `zod`. There is no bundled AI model — the CLI creates and tracks the artifacts; the intelligence comes from the AI agent that drives it via MCP.

## Development

```bash
npm install
npm run build       # compiles TypeScript to dist/
npm run dev         # tsc in watch mode
npm test            # runs the suite (vitest)
node bin/agentic-fy.js --version
```

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes first. When sending a pull request, fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md) so reviewers can understand the change quickly:

- Keep PRs focused and small where possible.
- Run `npm run build` and `npm test` before submitting.
- Add a CHANGELOG entry for user-facing changes.

## Documentation

- [Getting started](docs/getting-started.html)
- [Concepts](docs/concepts.html)
- [Commands](docs/commands.html)
- [Changelog](CHANGELOG.md)

## License

MIT — see [LICENSE](./LICENSE).
