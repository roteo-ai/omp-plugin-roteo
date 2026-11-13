// Claude models served by Roteo, in picker order.
//
// Every model runs with an explicit `[1m]` suffix: behind a custom
// ANTHROPIC_BASE_URL, Claude Code only asks for the 1M context window when the
// model id says so, and omp's compaction threshold must match the window
// Claude Code actually uses.

import type { ProviderModelConfig } from "@oh-my-pi/pi-coding-agent";

const ONE_M = 1_000_000;

interface RoteoModel {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
}

const CATALOG: RoteoModel[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", contextWindow: ONE_M, maxTokens: 128_000 },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", contextWindow: ONE_M, maxTokens: 128_000 },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", contextWindow: ONE_M, maxTokens: 128_000 },
  { id: "claude-fable-5-2", name: "Claude Fable 5.2", contextWindow: ONE_M, maxTokens: 128_000 },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", contextWindow: ONE_M, maxTokens: 128_000 },
];

export const MODELS: ProviderModelConfig[] = CATALOG.map((m) => ({
  id: m.id,
  name: m.name,
  reasoning: true,
  input: ["text", "image"],
  // Requests are billed on the Roteo balance (see the dashboard). omp's own
  // per-token estimate stays at zero rather than carrying a copy of the prices.
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: m.contextWindow,
  maxTokens: m.maxTokens,
}));

/** The model id handed to Claude Code (`--model`). Unknown ids pass through as typed. */
export function claudeCodeModelId(model: { id: string }): string {
  const known = CATALOG.find((m) => m.id === model.id);
  return known && known.contextWindow === ONE_M ? `${model.id}[1m]` : model.id;
}
