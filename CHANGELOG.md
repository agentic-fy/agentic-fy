# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0]

### Added

- **`explore <name>` now starts a change.** With a name, `explore` registers the change in the `exploring` state so it exists while you map the problem, before `propose` drafts the artifacts. Without a name it stays stateless (lists active changes). Exposed on both the CLI and the MCP server.
- **MCP parity with the CLI.** The MCP server now mirrors the CLI surface: `verify` accepts `allowGaps`, `merge` and `archive` accept `dryRun`, and two new tools are exposed — `doctor` (project integrity) and `config` (read-only view of the project configuration).
- **Slash commands / skills for `merge`, `validate`, and `status`.** `init` now generates command/skill files for these too, so AI agents discover the full workflow (early-sync and inspection), not just the five core steps.
- **Progress feedback for `init`.** `init` now shows a per-phase step indicator (structure → config → tools → skills) that resolves to a check mark, followed by the detailed report. A dependency-free spinner animates only on a TTY and only when a phase actually takes time (grace period), so fast runs stay clean and there is no artificial delay.
- **Progress feedback for the workflow commands.** `explore`, `propose`, `apply`, `merge`, and `archive` run behind the same spinner (shown only if the work outlasts a short grace period); `verify` shows it immediately, since it waits on evidence commands.
- **Logo on every `init` path.** The agentic-fy banner now appears whether `init` runs the interactive prompt or a non-interactive path (`--tools ...`, no TTY), without ever printing the logo twice.
- **`ticket` command.** Opens the project's GitHub "new issue" page in the browser for a bug report or feature request; `--print` only prints the URL (CI/headless), and it falls back to printing the URL when a browser can't be opened. No new dependency — it uses the OS's native opener.
- **Test suite (vitest).** Added unit tests for the core (spec merge engine, YAML delta parser, spec markdown round-trip, Levenshtein suggestions, task parser) and command-level tests that drive the full workflow (`init → explore → propose → apply → verify → merge → archive`) on disk in a temp directory.

### Changed

- **Tool selection in `init` is now single-select.** The interactive prompt chooses one AI tool with ↑/↓ to move the highlight and Enter to confirm (the filled square marks the cursor line). This replaces the space-to-toggle multi-select, which silently failed on terminals that don't deliver the spacebar to a raw-mode process (WSL, Git Bash/MSYS). To configure several tools at once, use `--tools kiro,cursor`.
- **Robust terminal input.** The prompt reads raw stdin bytes (arrows/Enter/Esc) instead of readline keypress events, and falls back to a numeric prompt on terminals where raw-mode keystrokes aren't reliably delivered (Git Bash/MSYS/Cygwin on Windows).
- **Selection marker restyled** to a filled/empty square (`◼`/`◻`), with the unselected rows dimmed.
- Moved the internal `resolveSingleChange` helper into `core/change.ts` (next to the other change helpers) and exported it, removing duplication.

### Fixed

- **Spec round-trip losing the statement.** `parseSpec` dropped a requirement's statement when it was immediately followed by a `verify` line, because a blank line between the statement and the verify/scenario blocks triggered a second flush that wiped the already-captured text. The statement is now preserved, so render → parse → render is stable.
- **MCP server version was hardcoded.** The server reported a stale, hardcoded version; it now reads the real version from `package.json`, matching the published package.
- **Double logo on `init`.** Removed a path that could render the banner twice.

[Unreleased]: https://github.com/agentic-fy/agentic-fy/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/agentic-fy/agentic-fy/releases/tag/v0.3.0
