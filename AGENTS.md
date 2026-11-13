# AGENTS.md

Notes for agents working in this repo. User-facing docs live in [README.md](README.md); what differs from upstream is in [UPSTREAM.md](UPSTREAM.md).

## What this is

An omp extension that registers the `roteo-claude` provider: omp's context goes through Anthropic's Agent SDK to the official Claude Code, which calls Roteo with the user's `ROTEO_API_KEY`. omp's tools are exposed to Claude Code as MCP tools (`mcp__custom-tools__<name>`), with Claude Code's own built-in tools switched off (`tools: []`).

No build step: omp loads the `.ts` files directly (`package.json` > `omp.extensions`).

## Rules for this fork

- **Runtime dependencies stay Anthropic's:** the Agent SDK, its two peers (`@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`) and `zod`, all pinned to versions at least two weeks old. Nothing else.
- **Roteo only.** `roteo.ts` builds the child environment. Never pass `process.env` through unfiltered and never set Claude Code variables on omp's own process.
- **Isolation.** `settingSources` is always `[]` and `CLAUDE_CONFIG_DIR` is always the plugin's own folder. Session files are written and deleted there (`claudeConfigDir()`), never in `~/.claude`.
- **Config is global only** (`config.ts`): a project file must never choose the Claude Code binary.
- **Models** live in `models.ts`. A new model needs its id there and must be live on Roteo's `/v1/models`. Every 1M model runs as `<id>[1m]`.
- User-visible text (README, notices, errors): no em dashes.

## File map

- `index.ts`: entry; session lifecycle hooks and provider registration (on every load, see the comment).
- `roteo.ts`: key, base URL, child environment, config folder.
- `models.ts`: the model list and the `--model` id handed to Claude Code.
- `config.ts`: optional `~/.omp/agent/roteo-claude.json`.
- `provider.ts`: orchestration: fresh queries, tool-result delivery to waiting MCP handlers, aborts, deferred user messages.
- `stream-processing.ts`: SDK stream events to omp's `AssistantMessageEventStream`; usage and cost.
- `session-store.ts`: the shared Claude Code session and its cursor-based sync (Cases 1 to 4).
- `cc-session.ts`: writes and deletes Claude Code session JSONL files.
- `convert.ts`: omp messages to Anthropic format; tool-name mapping; `<system-notice>` retagging.
- `tool-mapping.ts`: the reverse mapping (SDK names and argument keys back to omp's).
- `prompt.ts`: prompt extraction and the system-prompt append (tool naming note, subagent role, AGENTS.md, skills).
- `mcp-bridge.ts`, `typebox-to-zod.ts`: omp tools as an in-process MCP server.
- `query-state.ts`, `extract-tool-results.ts`, `session-verify.ts`, `skills.ts`, `agents-md.ts`, `debug.ts`, `runtime.ts`: supporting pieces.

## Gotchas (from upstream, still true)

- Session sync is cursor-based: `SessionStore.sync` picks clean start, reuse, rebuild with the same id, or rebuild with a rotated id after an abort. Changing message-shape assumptions means re-checking all four.
- Tool names and argument keys are translated both ways and asymmetrically (`convert.ts` one way, `tool-mapping.ts` the other).
- Bash gets an injected 120 s timeout when Claude sends none.
- omp sends a `developer` role next to `user`; role checks accept both.
- MCP handler to tool_use pairing is positional; out-of-order parallel calls can mis-pair.
- Plan-mode sub-queries can wipe extension providers in omp itself ("No API key for provider: roteo-claude"); not fixable here.

## Typecheck

omp's types come from `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` at the omp version in use. Do **not** install them in this repo: a copy in `node_modules` could be loaded instead of omp's own modules at runtime. Typecheck in a separate folder instead:

1. In an empty folder, install the four runtime dependencies at the pinned versions, plus `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent` (omp's version), `typescript@5.9.3` and `@types/node`, with `--ignore-scripts`.
2. Copy this repo's `*.ts` and `tsconfig.json` into it.
3. Run `node node_modules/typescript/bin/tsc --noEmit -p .` (never `npx tsc`).

Then run one live tool session: `omp -p -e ./index.ts --model roteo-claude/claude-haiku-5-5 "..."`.
