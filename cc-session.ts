// Writes Claude Code session files (JSONL under <config>/projects/<cwd hash>/)
// so a conversation omp already holds can be resumed by Claude Code.
//
// Only what the provider needs: create, import Anthropic-shaped messages, save,
// delete. Record layout and path rules follow cc-session-io 0.3.1 by Eli
// Dickinson (MIT), which upstream used as a dependency.

import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Anthropic message shapes as stored in a session record.
export type ContentBlock = { type: string; [key: string]: unknown };
export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  timestamp?: number | string;
}

interface SessionRecord {
  type: "user" | "assistant";
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  [key: string]: unknown;
}

// The Claude Code version recorded in written sessions; the CLI reads it as
// metadata only.
const RECORDED_VERSION = "2.1.312";
const MAX_SANITIZED_LENGTH = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeProjectPath(projectPath: string): string {
  try {
    return realpathSync(projectPath).normalize("NFC");
  } catch {
    return projectPath.normalize("NFC");
  }
}

// Claude Code's own project-directory naming.
function projectPathToHash(projectPath: string): string {
  const sanitized = projectPath.replace(/[^a-zA-Z0-9]/g, "-");
  if (sanitized.length <= MAX_SANITIZED_LENGTH) return sanitized;
  let h = 0;
  for (let i = 0; i < projectPath.length; i++) h = ((h << 5) - h + projectPath.charCodeAt(i)) | 0;
  return `${sanitized.slice(0, MAX_SANITIZED_LENGTH)}-${Math.abs(h).toString(36)}`;
}

function sessionPath(sessionId: string, projectPath: string, claudeDir: string): string {
  return join(claudeDir, "projects", projectPathToHash(normalizeProjectPath(projectPath)), `${sessionId}.jsonl`);
}

/** Every tool_use is answered by a tool_result in the next user turn, and no
 *  tool_result is left without its tool_use; the API rejects either gap. */
export function repairToolPairing(messages: Message[]): Message[] {
  const result: Message[] = [];
  let pending: Set<string> | null = null;
  const synthetic = (id: string): ContentBlock => ({
    type: "tool_result",
    tool_use_id: id,
    content: "[no tool result recorded]",
    is_error: true,
  });
  const flushPending = () => {
    if (pending && pending.size > 0) result.push({ role: "user", content: [...pending].map(synthetic) });
    pending = null;
  };
  for (const msg of messages) {
    if (msg.role === "assistant") {
      flushPending();
      const ids = new Set<string>();
      if (Array.isArray(msg.content)) {
        for (const b of msg.content) if (b.type === "tool_use" && typeof b.id === "string") ids.add(b.id);
      }
      result.push(msg);
      pending = ids.size > 0 ? ids : null;
      continue;
    }
    const blocks = Array.isArray(msg.content) ? msg.content : null;
    const hasToolResults = blocks?.some((b) => b.type === "tool_result") ?? false;
    if (!pending && !hasToolResults) {
      result.push(msg);
      continue;
    }
    const input: ContentBlock[] =
      blocks ?? (typeof msg.content === "string" && msg.content ? [{ type: "text", text: msg.content }] : []);
    const provided = new Set<string>();
    const open: Set<string> | null = pending;
    const kept = input.filter((b) => {
      if (b.type !== "tool_result") return true;
      const id = b.tool_use_id as string;
      if (open?.has(id)) {
        provided.add(id);
        return true;
      }
      return false;
    });
    if (open) {
      kept.unshift(...[...open].filter((id) => !provided.has(id)).map(synthetic));
      pending = null;
    }
    if (kept.length === 0) {
      if (result.length === 0) {
        result.push({ role: "user", content: [{ type: "text", text: "[orphaned tool result removed]" }] });
      }
      continue;
    }
    result.push({ ...msg, content: kept });
  }
  flushPending();
  return result;
}

const shortId = (prefix: string, length: number) => `${prefix}${randomUUID().replace(/-/g, "").slice(0, length)}`;

export class Session {
  readonly sessionId: string;
  readonly jsonlPath: string;
  private readonly cwd: string;
  private readonly model: string;
  private readonly slug = shortId("roteo-", 8);
  private records: SessionRecord[] = [];
  private pending: SessionRecord[] = [];
  private lastUuid: string | null = null;
  private nextTimestamp = Date.now();
  private fileExists = false;

  constructor(opts: { sessionId: string; jsonlPath: string; cwd: string; model: string }) {
    this.sessionId = opts.sessionId;
    this.jsonlPath = opts.jsonlPath;
    this.cwd = opts.cwd;
    this.model = opts.model;
  }

  /** User and assistant records, saved and pending. */
  get messages(): SessionRecord[] {
    return [...this.records, ...this.pending];
  }

  private base(type: "user" | "assistant"): SessionRecord {
    const uuid = randomUUID();
    const record: SessionRecord = {
      type,
      uuid,
      parentUuid: this.lastUuid,
      sessionId: this.sessionId,
      timestamp: new Date(this.nextTimestamp++).toISOString(),
      isSidechain: false,
      cwd: this.cwd,
      userType: "external",
      version: RECORDED_VERSION,
      gitBranch: "HEAD",
      slug: this.slug,
      entrypoint: "cli",
    };
    this.lastUuid = uuid;
    return record;
  }

  private addUser(content: string | ContentBlock[]): void {
    this.pending.push({ ...this.base("user"), message: { role: "user", content } });
  }

  private addAssistant(content: ContentBlock[]): void {
    const hasToolUse = content.some((b) => b.type === "tool_use");
    this.pending.push({
      ...this.base("assistant"),
      requestId: shortId("req_syn_", 24),
      message: {
        id: shortId("msg_syn_", 24),
        type: "message",
        role: "assistant",
        model: this.model,
        content,
        stop_reason: hasToolUse ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    });
  }

  /** Append Anthropic-shaped messages, repairing tool pairing first. */
  importMessages(messages: Message[]): void {
    for (const msg of repairToolPairing(messages)) {
      if (msg.role === "assistant") {
        this.addAssistant(typeof msg.content === "string" ? [{ type: "text", text: msg.content }] : msg.content);
      } else if (typeof msg.content === "string") {
        this.addUser(msg.content);
      } else {
        const toolResults = msg.content.filter((b) => b.type === "tool_result");
        if (toolResults.length > 0) {
          this.addUser(
            toolResults.map((r) => ({
              type: "tool_result",
              tool_use_id: r.tool_use_id,
              content: r.content,
              ...(r.is_error ? { is_error: true } : {}),
            })),
          );
        } else {
          const text = msg.content
            .filter((b) => b.type === "text")
            .map((b) => b.text as string)
            .join("\n");
          this.addUser(text || JSON.stringify(msg.content));
        }
      }
    }
  }

  /** Write pending records, creating the file and its directory when needed. */
  save(): void {
    if (this.pending.length === 0) return;
    const dir = dirname(this.jsonlPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const data = this.pending.map((r) => JSON.stringify(r) + "\n").join("");
    if (this.fileExists) appendFileSync(this.jsonlPath, data, "utf-8");
    else {
      writeFileSync(this.jsonlPath, data, "utf-8");
      this.fileExists = true;
    }
    this.records.push(...this.pending);
    this.pending = [];
  }
}

export function createSession(opts: {
  projectPath: string;
  claudeDir: string;
  sessionId?: string;
  model?: string;
}): Session {
  const sessionId = opts.sessionId ?? randomUUID();
  const projectPath = normalizeProjectPath(opts.projectPath);
  return new Session({
    sessionId,
    jsonlPath: sessionPath(sessionId, projectPath, opts.claudeDir),
    cwd: projectPath,
    model: opts.model ?? "claude-sonnet-5-5",
  });
}

/** Delete one session file and its companion directory. Refuses anything but a
 *  UUID session id, so a bad id can never widen the delete to the project folder. */
export function deleteSession(sessionId: string, projectPath: string, claudeDir: string): void {
  if (!UUID_RE.test(sessionId)) return;
  const jsonlPath = sessionPath(sessionId, projectPath, claudeDir);
  rmSync(jsonlPath, { force: true });
  rmSync(jsonlPath.slice(0, -".jsonl".length), { recursive: true, force: true });
}
