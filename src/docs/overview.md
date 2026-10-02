# Core concepts

**agentic-fy is a lightweight layer of agreement between you and your AI.** You write what a change should do, the AI drafts the details, you both look at the same plan, and only then is the code written. This page is the whole mental model on one screen. For the long version, see [Concepts](concepts.md).

The whole idea in four words: **agree first, build second.**

## The four ideas

Everything in agentic-fy is built from four concepts. Learn these and the rest is detail.

**1. A change is a unit of work.** When you want to add, modify, or remove behavior, you create a change: a folder under `agentic-fy/changes/` that keeps everything about that work in one place — proposal, design, task list, and the spec delta. One change, one folder, one feature.

**2. The artifacts build on each other.** A change contains a few documents, created in a natural order, each feeding the next:

```text
proposal ──► specs ──► design ──► tasks ──► implement
   why        what      how       steps       do
```

You can revisit any of them at any time. They're enablers, not gates. (More on that below.)

**3. Status tracks the lifecycle.** Each change has a status that moves through the workflow: `exploring → proposed → applying → converging → verified → archived`. The commands advance this status as you go.

**4. Archiving closes the loop.** When the work is done, you archive the change. Its folder moves to `agentic-fy/changes/archive/`, preserving the history. Now you're ready for the next change.

## The structure

```text
┌─────────────────────────────────────────────────────────────┐
│                        agentic-fy/                           │
│                                                              │
│   ┌──────────────────┐      ┌──────────────────────────┐    │
│   │      specs/      │      │        changes/          │    │
│   │                  │      │                          │    │
│   │  project specs   │      │  one folder per change   │    │
│   │                  │      │  proposal · design ·     │    │
│   │                  │      │  tasks · specs · archive/│    │
│   └──────────────────┘      └──────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Two folders. `specs/` holds project specs; `changes/` is what you're proposing and building. Archiving moves a finished change into `changes/archive/`.

## The loop you'll run

Day to day, your flow looks like this. Optionally think first; then one command drafts the plan, you review it, the next tracks the build, and the last archives it.

```text
agentic-fy explore add-dark-mode     →  (optional) start it in "exploring" and think with the AI
agentic-fy propose add-dark-mode     →  drafts proposal, specs, design, tasks
        (you read and adjust the plan)
agentic-fy apply                     →  tracks the tasks to implement
agentic-fy verify                    →  checks artifacts/tasks and runs the evidence commands
agentic-fy archive                   →  change archived
```

**When in doubt, start by exploring.** `explore` is a no-stakes thinking partner. Already know exactly what you want? Jump straight to `propose`.

These commands run in the terminal. To let your AI assistant drive the flow, connect the MCP server (`agentic-fy mcp`) — see [Commands](commands.md#mcp).

## "Enablers, not gates"

Old-school spec processes are waterfalls: finish planning, *then* you may implement, and going back is painful. agentic-fy refuses that. The order `proposal → specs → design → tasks` shows what becomes *possible* next, not what you're *required* to do.

Found during implementation that the design was wrong? Edit `design.md` and move on. Realized the scope should shrink? Update the proposal. Nothing locks. The dependencies exist only to give the AI the context it needs, not to trap you.

The trade-off is discipline: since nothing pushes you forward, it's on you to keep a change focused instead of letting it sprawl.

## Why the small overhead is worth it

Plain truth: agentic-fy adds a step. You write a short plan before building. What do you get?

- **You catch detours before they get expensive.** Fixing a misunderstanding in a one-paragraph proposal is free. Fixing it after the AI wrote 400 lines isn't.
- **The plan and the code live in the same repo.** Six months later, the spec explains why the system works the way it does.
- **Changes are reviewable.** A change folder is a tidy package: read the proposal, see the design, check the tasks.

And the honest trade-off: for a one-line fix the ceremony may not pay off, and that's fine. Use it where the agreement matters.

## Where to go next

- New here? [Getting started](getting-started.md) walks through the first change end to end.
- Want the deep version of everything above? [Concepts](concepts.md).
- Command reference? [Commands](commands.md).
