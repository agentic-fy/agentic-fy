# agentic-fy

A performant, lean TypeScript CLI for **spec-driven** workflows, with **MCP** support.

agentic-fy structures the spec-driven development cycle — from draft to archive — and exposes that flow both in the terminal and as an MCP server, so an AI agent can drive the work inside your IDE.

## Why agentic-fy

- **Lean.** Few dependencies, no ceremony. Easy to understand and extend.
- **MCP-first.** Integrates with the IDE via the Model Context Protocol, not via per-tool skill files.
- **Spec-driven.** Every change starts from clear artifacts: proposal, design, tasks, and spec.

## Requirements

- Node.js `>= 20.19.0`

## Installation

```bash
npm install -g agentic-fy
```

Or run without installing:

```bash
npx agentic-fy --version
```

## Quick start

```bash
cd your-project
agentic-fy init                    # creates the structure and integrates your IDE (MCP)
agentic-fy explore                 # (optional) think before coding
agentic-fy propose "dark mode"     # drafts proposal, design, tasks, and spec
agentic-fy apply                   # tracks the tasks
agentic-fy verify                  # checks whether it's ready
agentic-fy archive                 # archives the completed change
```

## What `init` creates

```
agentic-fy.config.yaml     # project configuration
agentic-fy/
├── specs/              # project specs
├── changes/            # proposed changes (one folder per change)
│   └── archive/        # completed changes
```

`init` is idempotent and also configures the MCP integration for your IDE. In the terminal it asks which tool to configure; to skip the prompt use `--tools`:

```bash
agentic-fy init --tools kiro,cursor   # configures the chosen tools
agentic-fy init --tools none          # only the base structure
```

The `mcp.json` merge is non-destructive: if you already have one, agentic-fy only adds its own server without deleting the rest.

## Commands

| Command | What it does |
|---|---|
| `init [path] [--tools <list>]` | Creates the base structure and integrates the AI tools (MCP) |
| `explore` | Thinking mode: maps the problem and lists active changes |
| `propose <name>` | Creates the change and drafts `proposal`, `design`, `tasks`, `specs/` |
| `apply [name]` | Reads `tasks.md` and reports task progress |
| `verify [name]` | Checks artifacts and tasks; marks as `verified` |
| `merge [name] [--dry-run]` | Applies the change's spec deltas to the project specs, keeping the change active (early-sync) |
| `archive [name] [--dry-run]` | Applies the spec deltas to the project specs, then archives the change |
| `list [--specs] [--long] [--json]` | Lists changes (or specs) |
| `show <name> [--artifact\|--spec] [--json]` | Shows a change, an artifact, or a spec |
| `validate [name] [--all] [--strict] [--json]` | Validates the artifacts of a change |
| `status [--json]` | Overview of changes by stage, progress, and issues |
| `config show \| set <key> <value>` | Reads and edits `agentic-fy.config.yaml` |
| `doctor [--json]` | Checks project integrity |
| `context [--json]` | Gathers config, changes, and specs into a brief for the agent |
| `view [--static] [--json]` | Specs and changes dashboard (interactive in the terminal) |
| `completion [shell]` | Prints an autocompletion script (powershell/bash/zsh) |
| `mcp` | Starts the MCP server (stdio) |

Full reference in [`docs/commands.md`](docs/commands.md).

## The artifacts of a change

When you run `propose`, the change gets:

| Artifact | Purpose |
|----------|---------|
| `proposal.md` | The "why" and the "what" — intent, scope, and approach |
| `specs/spec.md` | Requirements and acceptance criteria |
| `design.md` | The "how" — technical approach and decisions |
| `tasks.md` | Implementation checklist |

## Letting the AI drive (MCP)

If you chose a tool during `init`, your IDE's `mcp.json` has already been configured — just reload the IDE. To start the server manually:

```bash
agentic-fy mcp
```

It exposes the `explore`, `propose`, `apply`, `verify`, `merge`, `archive`, `list`, `show`, `validate`, `status`, and `context` tools to any MCP-compatible agent. Per-editor configuration details in [`docs/commands.md`](docs/commands.md#mcp).

## Development

```bash
npm install
npm run build       # compiles TypeScript to dist/
npm run dev         # tsc in watch mode
npm test            # runs the suite (vitest)
node bin/agentic-fy.js --version
```

## Documentation

- [Getting started](docs/getting-started.md)
- [Core concepts](docs/overview.md)
- [Commands](docs/commands.md)
- [Changelog](CHANGELOG.md)

## License

MIT
