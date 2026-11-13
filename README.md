# omp-plugin-roteo

Claude models in [oh-my-pi](https://omp.sh) (`omp`), through [Roteo](https://roteo.ai).

The plugin adds a `roteo-claude` provider to omp. Each request runs through the official Claude Code, driven by Anthropic's Agent SDK, and Claude Code sends it to Roteo with your Roteo key. omp's tools reach Claude as MCP tools, so you keep omp's interface, tools and approvals.

Open-weight and GPT models need no plugin: add Roteo to omp's `models.yml` instead (see the [Roteo docs](https://roteo.ai/docs)).

## Requirements

- omp 18.20 or newer
- Node.js with npm, to install the plugin's packages
- A Roteo API key from your [dashboard](https://app.roteo.ai)

Claude Code itself comes with the plugin (it is part of Anthropic's Agent SDK), so you don't need it installed or logged in.

## Install

omp loads every extension in `~/.omp/agent/extensions/` when it starts.

macOS / Linux:

```bash
git clone https://github.com/roteo-ai/omp-plugin-roteo ~/.omp/agent/extensions/omp-plugin-roteo
cd ~/.omp/agent/extensions/omp-plugin-roteo
npm ci --omit=dev --ignore-scripts
```

Windows (PowerShell):

```powershell
git clone https://github.com/roteo-ai/omp-plugin-roteo "$env:USERPROFILE\.omp\agent\extensions\omp-plugin-roteo"
cd "$env:USERPROFILE\.omp\agent\extensions\omp-plugin-roteo"
npm ci --omit=dev --ignore-scripts
```

To try it for one run without installing, pass the entry file instead: `omp -e /path/to/omp-plugin-roteo/index.ts`.

## Set your key

The plugin reads `ROTEO_API_KEY` from the environment omp starts from.

```bash
export ROTEO_API_KEY="sk_your_key"   # add it to ~/.zshrc or ~/.bashrc to keep it
```

On Windows, run `setx ROTEO_API_KEY "sk_your_key"` once, then open a new terminal.

## Pick a model

In omp, run `/model` and choose one:

| Model | Runs |
| --- | --- |
| `roteo-claude/claude-opus-5-5` | Claude Opus 5.5 |
| `roteo-claude/claude-sonnet-5-5` | Claude Sonnet 5.5 |
| `roteo-claude/claude-haiku-5-5` | Claude Haiku 5.5 |
| `roteo-claude/claude-fable-5-2` | Claude Fable 5.2 |
| `roteo-claude/claude-fable-5-1` | Claude Fable 5.1 |

All of them run with a 1M-token context window. To make one the default, pick it in omp's setup or set it under `modelRoles` in `~/.omp/agent/config.yml`, for example `default: roteo-claude/claude-sonnet-5-5`.

Fable's own safeguards turn down cybersecurity-related requests, as they do everywhere else. Use Opus or Sonnet for those tasks.

## What stays private

- **Your own Claude Code is left alone.** The plugin gives Claude Code its own folder (`~/.omp/agent/roteo-claude/claude-config`) and loads none of your Claude Code settings, hooks, plugins or login.
- **Only your Roteo key is used.** Any other Anthropic key, login or base URL in your environment is ignored by the plugin.
- **No telemetry.** Claude Code's telemetry, error reports and auto-updater are switched off.

## Billing

Requests are billed on your Roteo balance. omp's built-in cost estimate shows $0 for these models, so check your usage in the [dashboard](https://app.roteo.ai).

## Settings (optional)

`~/.omp/agent/roteo-claude.json`:

```json
{
  "pathToClaudeCodeExecutable": "/path/to/claude",
  "appendSystemPrompt": true,
  "strictMcpConfig": true
}
```

| Setting | Default | What it does |
| --- | --- | --- |
| `pathToClaudeCodeExecutable` | the bundled one | Run a different Claude Code binary |
| `appendSystemPrompt` | `true` | Pass omp's `AGENTS.md`, skills list and subagent role to Claude |
| `strictMcpConfig` | `true` | Offer Claude only omp's tools |

This file is read from your home folder only, never from a project, so a cloned repository can't change which program runs.

`ROTEO_BASE_URL` points the plugin at another Roteo endpoint (https only).

## If it fails

| You see | Do this |
| --- | --- |
| "No Roteo API key. Set ROTEO_API_KEY..." | Set the key in the environment omp starts from, then restart omp |
| "Failed to authenticate. API Error: 401 Invalid API key" | The key is wrong or revoked. Check it in your [dashboard](https://app.roteo.ai) |
| "API Error: 402 Insufficient balance..." | Top up in your [dashboard](https://app.roteo.ai). The message says how much is needed |
| "No API key for provider: roteo-claude" after a plan-mode step | A known omp issue with extension providers in plan mode. Restart omp |

For a detailed log, start omp with `ROTEO_CLAUDE_DEBUG=1`. It writes `~/.omp/agent/roteo-claude.log`, and nothing is logged while it is off.

## Credits

Forked from [omp-claude-bridge](https://github.com/barisdemirdelen/omp-claude-bridge) by Baris Demirdelen, itself a port of [pi-claude-bridge](https://github.com/elidickinson/pi-claude-bridge) by Eli Dickinson. MIT licensed, see [LICENSE](LICENSE). What changed is listed in [UPSTREAM.md](UPSTREAM.md).
