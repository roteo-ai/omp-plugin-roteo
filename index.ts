// omp extension entry: registers the `roteo-claude` provider, which runs
// Claude models through the official Claude Code (Anthropic's Agent SDK)
// against Roteo. All logic lives in the sibling modules (see AGENTS.md).

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { debug } from "./debug.js";
import { loadSettings } from "./config.js";
import { MODELS } from "./models.js";
import { createRuntime } from "./runtime.js";
import { createStreamClaudeAgentSdk } from "./provider.js";
import { PROVIDER_ID } from "./roteo.js";

export default function (pi: ExtensionAPI) {
  const runtime = createRuntime();
  runtime.providerSettings = loadSettings();
  debug("settings:", JSON.stringify(runtime.providerSettings));

  const streamClaudeAgentSdk = createStreamClaudeAgentSdk(runtime);

  // The shared Claude Code session follows omp's session lifecycle.
  const clearSession = (event: string) => {
    debug(`clearSession ${event}: clearing session ${runtime.sessions.current?.sessionId?.slice(0, 8) ?? "none"}`);
    runtime.sessions.clear();
  };
  pi.on("session_start", (_event, ctx) => {
    runtime.ui = ctx.ui;
    clearSession("session_start");
  });
  pi.on("session_shutdown", () => clearSession("session_shutdown"));

  // After omp compacts or moves in the session tree, the next turn rebuilds the
  // Claude Code session from omp's history.
  const markRebuild = (event: string) => {
    if (!runtime.sessions.current) return;
    debug(`${event}: marking needsRebuild on session ${runtime.sessions.current.sessionId.slice(0, 8)}`);
    runtime.sessions.markRebuild();
  };
  pi.on("session_compact", () => markRebuild("session_compact"));
  pi.on("session_tree", () => markRebuild("session_tree"));

  // Registered on every load: omp clears an extension's provider registrations
  // before flushing the ones a freshly loaded instance queued, so skipping a
  // re-registration (for example when a subagent session loads the extension)
  // would leave the model registry without this provider.
  pi.registerProvider(PROVIDER_ID, {
    baseUrl: PROVIDER_ID,
    apiKey: "not-used",
    api: PROVIDER_ID,
    models: MODELS,
    streamSimple: streamClaudeAgentSdk,
  });

  // Returned for tests; omp ignores an extension entry's return value.
  return runtime;
}
