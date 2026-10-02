# Commands

Reference for every `agentic-fy` CLI command. They all run in your terminal.

Global flags:
- `-v, --version` — shows the logo, the version, and the command list.
- `--help` — command help.
- `--no-color` — disables colored output.

Most commands (except `init` and `mcp`) require an already-initialized project — an `agentic-fy.config.yaml` in the current directory or a directory above it.

## init

```bash
agentic-fy init [path] [--tools <list>]
```

Creates the base project structure in `path` (default: current directory):

```
agentic-fy.config.yaml
agentic-fy/
├── specs/              (with .gitkeep)
├── changes/
│   └── archive/        (with .gitkeep)
```

Idempotent: running it again ensures the directories exist and does **not** overwrite `agentic-fy.config.yaml`.

### AI tool integration

Besides the structure, `init` configures the MCP integration of your AI tools, writing (or merging) each tool's `mcp.json` pointing to `agentic-fy mcp`. That way your IDE's agent sees agentic-fy's tools.

How tools are chosen:

- **Interactive** (TTY): `init` shows the list and lets you pick **one** tool with ↑/↓ and Enter (the filled square ◼ marks the highlighted line). Detected tools are highlighted first.
- **Non-interactive** (`--tools`): skips the prompt and is the way to configure **several** tools at once.
  - `--tools all` — configures every supported tool.
  - `--tools none` — configures none (just the base structure).
  - `--tools kiro,cursor` — configures only the listed ones.
- **No TTY and no `--tools`** (CI, pipes): configures no tool and proceeds normally.

> On terminals that don't deliver ordinary keystrokes to a raw-mode process (Git Bash/MSYS on Windows), the interactive prompt falls back to a numeric one. For several tools, prefer `--tools`.

Supported tools: `kiro`, `cursor`, `github-copilot`, `claude`, `windsurf`, `kimi`, `zed`, `opencode`.

The merge is **non-destructive and idempotent**: other MCP servers and keys already in the file are preserved; running it again does not duplicate or overwrite a config you edited by hand. Each tool is reported as `configured`, `updated`, or `unchanged`.

Examples:

```bash
agentic-fy init --tools kiro,cursor    # configures Kiro and Cursor
agentic-fy init --tools none           # just the base structure
agentic-fy init                        # asks (one tool), or nothing if no TTY
```

## explore

```bash
agentic-fy explore [name]
```

Thinking mode to map the problem before proposing. Without a name, it confirms an agentic-fy project exists and lists the active changes with their status — it doesn't create or change anything. With a `name`, it registers the change in the `exploring` state, so the change exists while you're still mapping the problem (before `propose` drafts the artifacts). It's idempotent: re-exploring an existing change is safe.

## propose

```bash
agentic-fy propose <name>
```

Creates a change and drafts the artifacts from templates:
- `proposal.md`, `design.md`, `tasks.md`
- `specs/<name>.delta.yaml` (the YAML spec delta)

The `<name>` is normalized into a slug (e.g. `"add login"` becomes `add-login`). It does not overwrite existing files. At the end, it marks the change status as `proposed`.

## apply

```bash
agentic-fy apply [name]
```

Reads the change's `tasks.md`, parses the checkboxes, and reports how many tasks are done and pending, listing the pending ones. Marks the status as `applying`.

If `name` is omitted and there is exactly one active change, it is used; if there are several, the command asks you to specify the name.

## verify

```bash
agentic-fy verify [name] [--allow-gaps]
```

Checks that the artifacts (`proposal`, `design`, `tasks`) exist and that all tasks are checked — and then collects **evidence**. Each requirement can declare a `verify` command in its spec delta; `verify` runs those commands (exit 0 = proven) and reports per requirement:

```
Evidence: 2/3 requirement(s) proven.
  ✓ dark-mode-toggle   (npm test -- theme)
  ✗ persist-preference FAILED: npm test -- persist — exit 1
  ✗ os-default-theme   NO EVIDENCE — no verify command
```

The change is only marked `verified` when nothing fails and there are no gaps. A requirement with no command is an honest gap, not a pass — there is no self-declared "manual" evidence. Use `--allow-gaps` to accept requirements that declare no command. When it isn't ready, the change enters the `converging` state and `verify` reports what's left.

## merge

```bash
agentic-fy merge [name] [--dry-run]
```

Applies the change's spec deltas (`specs/*.delta.yaml`) into the project's consolidated specs at `agentic-fy/specs/<capability>.md`, **keeping the change active** (no archive). This "early-sync" keeps the specs — and the context an AI agent reads — current while the change is still in progress. It uses the same idempotent, fail-loud merge engine as `archive`. Use `--dry-run` to preview without writing.

## archive

```bash
agentic-fy archive [name] [--dry-run]
```

Merges the change's spec deltas into the project's consolidated specs, then moves the change to `agentic-fy/changes/archive/<name>/` and marks the status as `archived`. The merge is deterministic and idempotent, and fails loudly if a delta references a requirement that doesn't exist. Use `--dry-run` to preview the merge without writing or archiving.

## list

```bash
agentic-fy list [--specs] [--long] [--json]
```

Lists the active changes (outside the archive). By default it prints just the names.

- `--long` — also shows the status, title (extracted from `proposal.md`), and task progress, e.g. `add-login (proposed): Login with OAuth [tasks 1/3]`.
- `--specs` — lists the project specs (`agentic-fy/specs/*.md`) instead of the changes.
- `--json` — structured output, useful for scripts and agents.

## show

```bash
agentic-fy show <name> [--artifact <id>] [--spec <id>] [--json]
```

Shows a change. With no flags, it prints a summary: status, title, task progress, and which artifacts exist.

- `--artifact <proposal|design|tasks>` — prints the raw content of that artifact.
- `--spec <id>` — prints the content of a project spec (`agentic-fy/specs/<id>.md`); independent of any change.
- `--json` — structured summary of the change.

If the name doesn't match any change, the command suggests the closest names ("did you mean?").

## validate

```bash
agentic-fy validate [name] [--all] [--strict] [--json]
```

Validates a change's artifacts and reports issues at `ERROR`, `WARNING`, or `INFO` level. Unlike `verify` (which only checks presence and checkboxes), `validate` catches artifacts that *look* ready but aren't:

- missing artifact (`ERROR`);
- artifact still identical to the template, i.e. unfilled (`WARNING`);
- practically empty artifact (`WARNING`);
- `tasks.md` with list items but no real checkbox (`ERROR`);
- the YAML spec deltas: malformed YAML or an invalid structure is a hard `ERROR`, an untouched delta template is a `WARNING`;
- tasks still pending (`INFO`).

Options:
- `--all` — validates every active change.
- `--strict` — treats `WARNING` as a failure (affects the exit code).
- `--json` — structured output (a report, or an array with `--all`).

If `name` is omitted and there is exactly one active change, it is used. The exit code is `1` when any change is invalid.

## status

```bash
agentic-fy status [--json]
```

Overview of the active changes: how many there are, what stage they're in, and how much is left. For each change it shows the status, task progress, and a summary of issues (`ok`, `N warning(s)`, or `N error(s)`, from the same check as `validate`). Useful as a bird's-eye view before deciding what to work on.

## config

```bash
agentic-fy config show [--json]
agentic-fy config set <key> <value>
```

Reads or edits `agentic-fy.config.yaml`.

- `config show` — shows `version`, `schema`, and the `workflow`.
- `config set <key> <value>` — changes a value. Editable keys: `version` (positive integer) and `schema`. The value is validated against the schema before saving, so invalid config is never written.

## doctor

```bash
agentic-fy doctor [--json]
```

Checks the project's integrity (read-only, repairs nothing):

- `agentic-fy.config.yaml` exists and is valid;
- directories in `changes/` without `.agentic-fy.yaml` (not valid changes) — `WARNING`;
- changes with unreadable metadata — `ERROR`;
- structural errors in artifacts (e.g. `tasks.md` with no checkbox) — `ERROR`.

The exit code is `1` when there's any `ERROR`. Unlike `validate` (focused on a change's content), `doctor` looks at the consistency of the whole project.

## context

```bash
agentic-fy context [--json]
```

Gathers the project context in one place: config (schema and workflow), the active changes with stage and progress, and the project specs. Designed to feed an AI agent the whole state at once. As text it's a readable brief; with `--json`, structured.

## completion

```bash
agentic-fy completion [shell]
```

Prints an autocompletion script for the shell (`powershell`, `bash`, or `zsh`) to stdout. If the shell isn't given, it tries to detect it from the environment. It doesn't install anything automatically — redirect it wherever you prefer:

```bash
agentic-fy completion bash >> ~/.bashrc     # Bash
agentic-fy completion zsh  >> ~/.zshrc      # Zsh
agentic-fy completion powershell            # PowerShell: paste into your $PROFILE
```

## ticket

```bash
agentic-fy ticket [--print]
```

Opens the agentic-fy **new issue** page on GitHub so you can file a bug report or feature request. It opens the URL in your default browser using the OS's native handler (no extra dependency). Use `--print` to only print the URL instead of opening it (useful in CI or over SSH); if a browser can't be opened, the URL is printed as a fallback.

## view

```bash
agentic-fy view [--static] [--json]
```

A dashboard of specs and changes. It shows a summary (change/spec counts and overall task progress) and groups the changes by stage: drafts (`exploring`/`proposed`), in progress (`applying`, with a progress bar), and done (`verified`).

Modes:
- **Interactive** (default, when there's a terminal): besides the panel, it lists the items numbered; type the number to open a change's detail or a spec's content, `r` to refresh, and `q` to quit.
- `--static` — prints the panel once and exits (no navigation). This is the mode used automatically when there's no interactive terminal (e.g. pipes, CI).
- `--json` — returns the dashboard data structured.

## mcp

```bash
agentic-fy mcp
```

Starts the MCP (Model Context Protocol) server over stdio, exposing the commands as tools an AI agent can consume. Registered tools: `explore`, `propose`, `apply`, `verify` (accepts `allowGaps`), `merge` and `archive` (both accept `dryRun`), `list`, `show`, `validate`, `status`, `context`, `doctor`, and `config` (read-only).

### Connect to Kiro

Create (or edit) Kiro's MCP configuration file:
- Workspace (this project only): `.kiro/settings/mcp.json`
- User (all projects): `~/.kiro/settings/mcp.json`

```json
{
  "mcpServers": {
    "agentic-fy": {
      "command": "npx",
      "args": ["-y", "@agentic-fy/agentic-fy", "mcp"],
      "disabled": false,
      "autoApprove": ["explore", "list", "show", "validate"]
    }
  }
}
```

If `agentic-fy` is installed globally, you can use the binary directly:

```json
{
  "mcpServers": {
    "agentic-fy": {
      "command": "agentic-fy",
      "args": ["mcp"],
      "disabled": false,
      "autoApprove": ["explore", "list", "show", "validate"]
    }
  }
}
```

`autoApprove` lets the read-only tools run without confirmation; the ones that write (`propose`, `apply`, `merge`, `archive`) still ask for approval.

### Connect to other editors

VS Code-based editors with MCP support use the same format, changing the file:
- **Cursor**: `.cursor/mcp.json`
- **GitHub Copilot (VS Code)**: `.vscode/mcp.json` (uses the `servers` key instead of `mcpServers`)
- **Claude Code**: `.mcp.json`
- **Windsurf**: `.windsurf/mcp.json`
- **OpenCode**: `opencode.json` (uses its own `mcp` key with a local-server entry: `{ "type": "local", "command": ["npx", "-y", "@agentic-fy/agentic-fy", "mcp"] }`)
- **Kimi Code**: `.kimi-code/mcp.json` (standard `mcpServers` shape; also supports a global `~/.kimi-code/mcp.json`)
- **Zed**: `.zed/settings.json` (uses the `context_servers` key instead of `mcpServers`)
