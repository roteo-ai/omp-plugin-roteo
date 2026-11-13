// Shared mutable provider state. Constructed once at extension registration
// and threaded into the provider factory.

import type { ExtensionUIContext } from "@oh-my-pi/pi-coding-agent";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { ProviderSettings } from "./config.js";
import { SessionStore } from "./session-store.js";

/** The Claude Agent SDK `query` entry point; injectable so provider.ts
 *  orchestration can be driven by a scripted fake in tests. */
export type QueryFn = typeof query;

export interface BridgeRuntime {
  providerSettings: ProviderSettings;
  sessions: SessionStore;
  ui: ExtensionUIContext | null;
  queryFn: QueryFn;
}

export function createRuntime(): BridgeRuntime {
  const runtime: BridgeRuntime = {
    providerSettings: {},
    sessions: new SessionStore((message, level) =>
      runtime.ui?.notify(message, level),
    ),
    ui: null,
    queryFn: query,
  };
  return runtime;
}
