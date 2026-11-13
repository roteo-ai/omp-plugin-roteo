// Optional settings in ~/.omp/agent/roteo-claude.json.
//
// Global only, on purpose: a project-level file could otherwise point
// `pathToClaudeCodeExecutable` at a program shipped inside a cloned repository.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROVIDER_ID, agentDir } from "./roteo.js";

export interface ProviderSettings {
  /** A Claude Code binary to run instead of the one bundled with the Agent SDK. */
  pathToClaudeCodeExecutable?: string;
  /** Append omp's AGENTS.md, skills list and subagent role to Claude Code's prompt (default true). */
  appendSystemPrompt?: boolean;
  /** Offer Claude Code only omp's tools, never MCP servers from other config (default true). */
  strictMcpConfig?: boolean;
}

export function settingsPath(): string {
  return join(agentDir(), `${PROVIDER_ID}.json`);
}

export function loadSettings(path: string = settingsPath()): ProviderSettings {
  if (!existsSync(path)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    console.error(`${PROVIDER_ID}: ignoring ${path}, it is not valid JSON (${e})`);
    return {};
  }
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const settings: ProviderSettings = {};
  if (typeof input.pathToClaudeCodeExecutable === "string" && input.pathToClaudeCodeExecutable.trim()) {
    settings.pathToClaudeCodeExecutable = input.pathToClaudeCodeExecutable.trim();
  }
  if (typeof input.appendSystemPrompt === "boolean") settings.appendSystemPrompt = input.appendSystemPrompt;
  if (typeof input.strictMcpConfig === "boolean") settings.strictMcpConfig = input.strictMcpConfig;
  return settings;
}
