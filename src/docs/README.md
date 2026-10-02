# agentic-fy documentation

Welcome. This is the starting point for everything about agentic-fy.

agentic-fy helps you and your AI assistant **agree on what to build before writing any code.** You describe the change, the AI drafts a short spec and a task list, you both look at the same plan, and then the work happens. No discovering halfway through that the AI built the wrong thing.

If you only read two pages, read these:

1. [Getting started](getting-started.md): install, initialize, and ship your first change.
2. [Core concepts](overview.md): the whole mental model on one page.

agentic-fy has two halves: a command-line tool you run in the terminal, and an MCP server that exposes the workflow as tools for your AI assistant. Knowing which is which avoids the most common point of confusion.

> **The best habit to start with: when you don't know what to build, start with `explore`.** It's a no-stakes thinking partner that reads your code, weighs options, and turns a fuzzy idea into a concrete plan before any code is written.

## Choose your path

**I'm new here.** Start with [Getting started](getting-started.md), then skim [Core concepts](overview.md).

**I have a problem, but no plan.** Use `explore` to think alongside the AI before committing to anything.

**I just want it running.** [Install](getting-started.md#installation), run `agentic-fy init`, and connect the MCP server to your assistant (see [Commands](commands.md#mcp)).

**I learn from a command reference.** The [Commands](commands.md) page documents every CLI command.

**I want to understand deeply.** [Concepts](concepts.md) has the long explanation of specs, changes, artifacts, and archiving.

## The full map

### Start here

| Doc | What it gives you |
|-----|-------------------|
| [Getting started](getting-started.md) | Install, initialize, and run your first change end to end |
| [Core concepts](overview.md) | The whole mental model on one page: specs, changes, artifacts, archive |
| [Commands](commands.md) | Reference for every `agentic-fy` CLI command |

### Go deep

| Doc | What it gives you |
|-----|-------------------|
| [Concepts](concepts.md) | The long explanation of specs, changes, artifacts, and archiving |

## The thirty-second version

```text
1. Install     npm install -g @agentic-fy/agentic-fy
2. Initialize  cd your-project && agentic-fy init
3. Explore     agentic-fy explore add-dark-mode   ← optional, but a great habit
4. Propose     agentic-fy propose add-dark-mode
5. Apply       agentic-fy apply
6. Verify      agentic-fy verify
7. Archive     agentic-fy archive
```

The commands run in your terminal. To let the AI assistant drive the flow on its own, connect the MCP server (`agentic-fy mcp`) — see [Commands](commands.md#mcp).

## Where to get help

- **npm:** [@agentic-fy/agentic-fy](https://www.npmjs.com/package/@agentic-fy/agentic-fy)
- **Issues:** `agentic-fy ticket` opens the GitHub new-issue page.

Found something in these docs that's wrong, outdated, or confusing? That's a bug. Open an issue or a PR.
