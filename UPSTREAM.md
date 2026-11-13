# Upstream

Fork point: [`barisdemirdelen/omp-claude-bridge`](https://github.com/barisdemirdelen/omp-claude-bridge) at `299a1de` (2026-08-12, "Merge pull request #1 from VictorNanka/feat/opus-5"). That repo ports [`elidickinson/pi-claude-bridge`](https://github.com/elidickinson/pi-claude-bridge) to omp.

## What this fork changed

| Area | Upstream | This fork |
| --- | --- | --- |
| Provider | `claude-bridge`, the user's own Claude login | `roteo-claude`, Roteo only (`roteo.ts`) |
| Auth | inherits the whole environment | strips every other Anthropic key, backend, login and `CLAUDE_CONFIG_DIR`; sets Roteo's URL, the `ROTEO_API_KEY` token and an `X-Roteo-Client` header on the child only; fails before Claude Code starts without a key |
| Claude Code settings | omitted `settingSources`, which in SDK 0.3 loads all of the user's settings (hooks, env, plugins) | always `settingSources: []` (SDK isolation mode) |
| Claude Code config dir | the user's `~/.claude` | `~/.omp/agent/roteo-claude/claude-config` |
| Privacy env | wrote `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` into omp's own process | child only, plus `DISABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`, `CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK` |
| Models | Opus 5 / 4.8 / 4.7 / 4.6, Sonnet 5 / 4.6, Haiku 4.5, Fable 5; plan-based 1M rules | Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.2, Fable 5.1, all `[1m]` |
| Config | `~/.omp/agent/claude-bridge.json` merged with a project `.omp/claude-bridge.json` (which could set `pathToClaudeCodeExecutable`) | `~/.omp/agent/roteo-claude.json`, global only, three known keys |
| AskClaude tool | included | removed (`askclaude.ts`, `askclaude-ui.ts`) |
| Dependencies | Agent SDK 0.2.141, `cc-session-io`, `change-case`, `typebox`, `zod`; lockfile out of sync | Agent SDK 0.3.312 with its peers `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk`, plus `zod`; all pinned |
| Session files | `cc-session-io` | `cc-session.ts` (the subset used, same record layout; deletes only UUID session ids) |
| `pascalCase` | `change-case` | local function in `convert.ts` |
| Cost | `calculateCost` from pi-ai (no longer exported in omp 18) | local `applyCost` in `stream-processing.ts` |
| Effort | `model.thinkingLevelMap` (gone from omp 18's `Model`) | `REASONING_TO_EFFORT` only |
| Debug | `CLAUDE_BRIDGE_DEBUG`; `diagDump` wrote even with debug off | `ROTEO_CLAUDE_DEBUG`; nothing written while off |
| Rate-limit notice | read unix seconds as milliseconds | converted |
| Imports | `@earendil-works/*` through omp's compat shim | `@oh-my-pi/*` |
| Tests | `test/` against upstream modules | not carried over yet |

Modules carried over with only the edits above: `provider.ts`, `stream-processing.ts`, `session-store.ts`, `convert.ts`, `prompt.ts`, `agents-md.ts`, `skills.ts`, `mcp-bridge.ts`, `query-state.ts`, `tool-mapping.ts`, `extract-tool-results.ts`, `typebox-to-zod.ts`, `session-verify.ts`, `debug.ts`, `runtime.ts`. Their header comments still say where they came from.

## Taking an upstream change

1. Read the upstream diff since the fork point (the commit above).
2. Apply what touches the carried-over modules by hand, keeping this fork's rows in the table.
3. Skip anything for AskClaude, plan-based context rules or `cc-session-io` itself (port the behaviour into `cc-session.ts` if it matters).
4. Typecheck (see AGENTS.md), then run one live tool session through Roteo.
5. Move the fork point above to the commit you merged.
