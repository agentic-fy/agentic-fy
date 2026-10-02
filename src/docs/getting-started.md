# Getting started

This guide explains how agentic-fy works, from install to your first change. New to all the docs? The [index](README.md) maps everything.

agentic-fy is a Node.js CLI. You need version 20.19.0 or newer.

## Installation

In your terminal, check Node:

```bash
node --version
```

If it prints `v20.19.0` or higher, you're set. If not, install a newer Node from nodejs.org or via a version manager (nvm, fnm, asdf, volta).

Install the CLI globally:

```bash
npm install -g @agentic-fy/agentic-fy
```

If you can't install globally (permission error under `/usr/local`), run it directly without installing:

```bash
npx @agentic-fy/agentic-fy --version
```

### Confirm it worked

```bash
agentic-fy --version
```

If it prints the logo and a version number, the CLI is on your PATH.

## Your first five minutes

The whole loop:

```text
$ npm install -g @agentic-fy/agentic-fy
$ cd your-project && agentic-fy init
$ agentic-fy explore add-dark-mode      (optional: start it in "exploring" and think first)
$ agentic-fy propose add-dark-mode      (drafts the plan; you review it)
$ agentic-fy apply                      (tracks the tasks)
$ agentic-fy verify                     (runs evidence; checks it's ready)
$ agentic-fy archive                    (change archived)
```

> **Not sure what to build yet? Start with `agentic-fy explore`.** It's a no-stakes thinking partner: it shows the project state and active changes, and helps turn a fuzzy idea into a concrete plan before any code. Give it a name (`explore add-dark-mode`) to start the change in the `exploring` state.

## What agentic-fy creates

After running `agentic-fy init`, your project gets this structure:

```
agentic-fy.config.yaml     # project configuration
agentic-fy/
├── specs/              # project specs
├── changes/            # proposed changes (one folder per change)
│   └── archive/        # completed changes
```

`init` creates the base structure idempotently (running it again does not overwrite `agentic-fy.config.yaml`) and also **configures your IDE's MCP integration**. In a terminal it asks which AI tool to configure (pick one with ↑/↓ and Enter) and writes the matching `mcp.json` pointing to `agentic-fy mcp`. To skip the prompt — or to configure several tools at once — use `--tools`:

```bash
agentic-fy init --tools kiro,cursor   # configure the chosen tools
agentic-fy init --tools none          # just the base structure
```

The merge is non-destructive: if you already have an `mcp.json`, agentic-fy only adds its own server without deleting the rest. See [Commands](commands.md#init) for the details.

When you create a change with `propose`, it looks like this:

```
agentic-fy/changes/<change-name>/
├── proposal.md
├── design.md
├── tasks.md
├── specs/
│   └── <change-name>.delta.yaml
└── .agentic-fy.yaml       # metadata (name, status, dates)
```

## Understanding the artifacts

Each change folder contains artifacts that guide the work:

| Artifact | Purpose |
|----------|---------|
| `proposal.md` | The "why" and "what" — intent, scope, and approach |
| `specs/<capability>.delta.yaml` | Spec delta: how the requirements change (merged into the project specs on archive) |
| `design.md` | The "how" — technical approach and architecture decisions |
| `tasks.md` | Implementation checklist with checkboxes |

The artifacts build on each other:

```
proposal ──► specs ──► design ──► tasks ──► implement
   ▲           ▲          ▲                    │
   └───────────┴──────────┴────────────────────┘
              update as you learn
```

You can always go back and refine earlier artifacts as you learn during implementation.

## Example: your first change

Let's add dark mode to an application.

### 1. Initialize the project

```bash
cd your-project
agentic-fy init
```

### 2. Create the change

```text
$ agentic-fy propose add-dark-mode

[propose] add-dark-mode
Created: proposal.md
Created: design.md
Created: tasks.md
Created: specs/add-dark-mode.delta.yaml
```

### 3. Fill in the artifacts

Edit the files in `agentic-fy/changes/add-dark-mode/`:
- `proposal.md` — why and what changes.
- `design.md` — how to do it.
- `specs/add-dark-mode.delta.yaml` — how the requirements change (add/modify/remove, each able to declare a `verify` command).
- `tasks.md` — write the real tasks, for example:

```markdown
# Tasks — add-dark-mode

- [ ] 1. Create ThemeContext with light/dark state
- [ ] 2. Add a theme toggle to settings
- [ ] 3. Persist the preference in localStorage
```

### 4. Track the implementation

```text
$ agentic-fy apply

[apply] add-dark-mode
Applying change "add-dark-mode".
Tasks: 0 completed, 3 pending.
  [ ] 1. Create ThemeContext with light/dark state
  [ ] 2. Add a theme toggle to settings
  [ ] 3. Persist the preference in localStorage
```

Implement the tasks and mark them `[x]` in `tasks.md` as you go.

### 5. Verify

If your requirements declare a `verify` command in the spec delta, `verify` runs them and reports evidence per requirement. A change is only marked `verified` when the evidence passes and there are no gaps (use `--allow-gaps` to accept requirements without a command).

```text
$ agentic-fy verify

[verify] add-dark-mode
All artifacts present (proposal, design, tasks).
All tasks marked as completed.
Evidence: 2/2 requirement(s) proven.
  ✓ dark-mode-toggle    (npm test -- theme)
  ✓ persist-preference  (npm test -- persist)
Status updated to "verified".
```

### 6. Archive

Archiving merges the change's spec delta into the project's consolidated specs, then moves the change to history. Preview the merge first with `agentic-fy archive --dry-run`.

```text
$ agentic-fy archive

[archive] add-dark-mode
Spec "dark-mode" created: +1 ~0 -0
Change "add-dark-mode" archived at agentic-fy/changes/archive/add-dark-mode.
```

## Letting the AI drive (MCP)

The commands above run in the terminal. To let your AI assistant drive the workflow, use the MCP server.

If you chose a tool during `agentic-fy init` (or passed `--tools`), your IDE's `mcp.json` was already configured — just reload the IDE. To configure manually or start the server by hand:

```bash
agentic-fy mcp
```

It exposes the `explore`, `propose`, `apply`, `verify`, `merge`, `archive`, `list`, `show`, `validate`, `status`, `context`, `doctor`, and `config` tools to any MCP-compatible agent. See [Commands](commands.md#mcp) for setup in editors like Kiro.

## Next steps

- [Core concepts](overview.md) — the mental model on one page
- [Commands](commands.md) — reference for every command
- [Concepts](concepts.md) — deep understanding of specs, changes, and archiving
