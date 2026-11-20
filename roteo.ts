// Roteo wiring for the Claude Code child: where it sends requests, with which
// key, and the config directory that keeps it apart from the user's own Claude
// Code.
//
// omp drives the official Claude Code CLI through Anthropic's Agent SDK and
// Roteo (https://roteo.ai) serves the model. The child never falls back to a
// claude.ai login or to api.anthropic.com: without a key the turn fails before
// Claude Code starts.

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const PROVIDER_ID = "roteo-claude";
export const VERSION = "0.1.1"; // keep equal to package.json `version`
export const KEY_ENV = "ROTEO_API_KEY";
export const URL_ENV = "ROTEO_BASE_URL";
export const DEFAULT_BASE_URL = "https://api.roteo.ai";
// Roteo logs it to tell this traffic apart; the gateway does not forward it upstream.
export const CLIENT_HEADER = "X-Roteo-Client";
export const DASHBOARD_URL = "https://app.roteo.ai";

export const KEY_HINT =
  `No Roteo API key. Set ${KEY_ENV}=sk_... in the environment omp starts from ` +
  `(create a key at ${DASHBOARD_URL}), then restart omp.`;

// Nothing else may authenticate or route the child next to Roteo: another
// Anthropic key or backend, the user's claude.ai login, or their own Claude Code
// config directory (which holds that login).
const FOREIGN_AUTH = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_FOUNDRY_API_KEY",
  "ANTHROPIC_CUSTOM_HEADERS",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "CLAUDE_CONFIG_DIR",
]);

export function roteoKey(): string | undefined {
  const value = process.env[KEY_ENV]?.trim();
  return value ? value : undefined;
}

export function baseUrl(): string {
  const url = (process.env[URL_ENV]?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  // Plain http only to this machine (a local gateway): the key must not cross a
  // network in clear.
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);
  if (!url.startsWith("https://") && !local) {
    throw new Error(`${URL_ENV} must use https: ${url}`);
  }
  return url;
}

/** omp's agent directory (`~/.omp/agent` unless omp's own overrides say otherwise). */
export function agentDir(): string {
  const override = process.env.PI_CODING_AGENT_DIR?.trim();
  if (override) return override;
  return join(homedir(), process.env.PI_CONFIG_DIR?.trim() || ".omp", "agent");
}

/** Claude Code's own config directory for this plugin, apart from the user's ~/.claude. */
export function claudeConfigDir(): string {
  const dir = join(agentDir(), PROVIDER_ID, "claude-config");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The Claude Code child's environment: omp's own, minus every other way to
 *  authenticate or route, plus Roteo and the privacy switches. */
export function childEnv(key: string): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  // Windows environment names are case-insensitive, so match them that way.
  for (const [name, value] of Object.entries(process.env)) {
    if (!FOREIGN_AUTH.has(name.toUpperCase())) env[name] = value;
  }
  return {
    ...env,
    ANTHROPIC_BASE_URL: baseUrl(),
    ANTHROPIC_AUTH_TOKEN: key,
    ANTHROPIC_CUSTOM_HEADERS: `${CLIENT_HEADER}: omp-roteo/${VERSION}`,
    // Claude Code names its caller on every request (user-agent and billing
    // block). The Agent SDK would say `sdk-ts`; this child names omp-roteo
    // instead, its own honest name, also when omp starts inside another Claude
    // Code that set the variable for its own children.
    CLAUDE_CODE_ENTRYPOINT: "omp-roteo",
    CLAUDE_CONFIG_DIR: claudeConfigDir(),
    // Claude Code's telemetry, error reports, auto-updater and feedback stay off.
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    // A refused turn reports the refusal instead of quietly switching models.
    CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK: "1",
    ENABLE_CLAUDEAI_MCP_SERVERS: "0",
    // omp compacts the conversation itself.
    DISABLE_AUTO_COMPACT: "1",
  };
}
