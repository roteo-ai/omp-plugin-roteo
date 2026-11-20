# Changelog

## 0.1.1 (2026-11-20)

### Changed
- Claude Code now names its caller `omp-roteo` on every request, in place of the Agent SDK's default `sdk-ts`, also when omp runs inside another Claude Code.

## 0.1.0 (2026-11-13)

First release of the Roteo fork of omp-claude-bridge.

### Added
- `roteo-claude` provider: Claude Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.2 and Fable 5.1 through Roteo, all with a 1M context window.
- `ROTEO_API_KEY` and `ROTEO_BASE_URL`; a clear message when the key is missing, before Claude Code starts.
- Claude Code runs in its own folder with none of the user's settings, telemetry off.

### Changed
- Agent SDK 0.3.312; runtime dependencies reduced to Anthropic's SDK packages and zod.
- Settings in `~/.omp/agent/roteo-claude.json`, global only.

### Removed
- The AskClaude tool.
- `cc-session-io`, `change-case` and `typebox`.
