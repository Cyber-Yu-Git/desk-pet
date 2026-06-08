/**
 * Claude Code Adapter — Anthropic 官方 Claude CLI
 *
 * 通过 Claude Code Hooks 机制监听 8 个事件：
 * SessionStart / UserPromptSubmit / PreToolUse / PostToolUse /
 * Notification / Stop / StopFailure / SubagentStop
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AgentAdapter, AgentInstallTarget, DiscoveredAgentInstallation, NormalizedAgentEvent } from '../adapter';
import { discoverNativeAndWsl } from '../discovery';

const HOOK_EVENTS = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'Notification', 'Stop', 'StopFailure', 'SubagentStop'
];
const HOOK_MARKER = 'cyber-yu-desk-pet-agent-hook:v1';

export const claudeAdapter: AgentAdapter = {
  kind: 'claude-code',
  name: 'Claude Code',

  discover(): DiscoveredAgentInstallation[] {
    return discoverNativeAndWsl('.claude', 'settings.json');
  },

  install(target: AgentInstallTarget, endpoint: string, token: string): void {
    const settings = readSettings(target.settingsPath);
    const hookCmd = buildHookCommand(target, endpoint, token);

    settings.hooks ??= {};
    for (const event of HOOK_EVENTS) {
      settings.hooks[event] ??= [];
      settings.hooks[event] = settings.hooks[event].filter(
        (h: { hooks?: Array<{ command?: string }> }) =>
          !h.hooks?.some((c) => c.command?.includes(HOOK_MARKER))
      );
      settings.hooks[event].push({ matcher: '', hooks: [{ type: 'command', command: hookCmd }] });
    }

    writeSettings(target.settingsPath, settings);
  },

  remove(target: AgentInstallTarget): void {
    const settings = readSettings(target.settingsPath);
    if (!settings.hooks) return;

    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].filter(
        (h: { hooks?: Array<{ command?: string }> }) =>
          !h.hooks?.some((c) => c.command?.includes(HOOK_MARKER))
      );
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }

    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    writeSettings(target.settingsPath, settings);
  },

  normalize(raw: unknown): NormalizedAgentEvent {
    const data = asRecord(raw) ?? {};
    const eventName = String(data.hook_event_name ?? 'Unknown');
    const sessionId = String(data.session_id ?? '') || fallbackSessionId(data);
    const cwd = String(data.cwd ?? '');
    const projectName = cwd.split(/[\\/]/).filter(Boolean).at(-1);
    const prompt = String(data.prompt ?? '');
    const message = String(data.message ?? '');
    const status = mapClaudeEvent(eventName, message);

    return {
      sessionId,
      title: prompt ? truncate(prompt, 80) : projectName ? `Claude: ${projectName}` : `Claude: ${eventName}`,
      status,
      message: message ? truncate(message, 180) : eventName,
      projectPath: cwd || undefined,
      priority: status === 'completed' || status === 'failed' || status === 'waiting_permission' ? 'high' : 'normal'
    };
  },

  isInstalled(target: AgentInstallTarget): boolean {
    if (!existsSync(target.settingsPath)) return false;
    try {
      const raw = readFileSync(target.settingsPath, 'utf8');
      return raw.includes(HOOK_MARKER);
    } catch { return false; }
  }
};

function mapClaudeEvent(name: string, message: string): NormalizedAgentEvent['status'] {
  const msg = message.toLowerCase();
  if (name === 'Stop' || name === 'SubagentStop') return 'completed';
  if (name === 'StopFailure') return 'failed';
  if (name === 'Notification') return msg.includes('permission') || msg.includes('confirm') ? 'waiting_permission' : 'running';
  if (name === 'SessionStart' || name === 'UserPromptSubmit') return 'started';
  return 'running';
}

function buildHookCommand(target: AgentInstallTarget, endpoint: string, token: string): string {
  const marker = `${HOOK_MARKER}:${target.scope}`;
  const bridgePath = join(dirname(target.settingsPath), '.desk-pet', 'agent-hook-bridge.mjs');
  // Ensure bridge script exists
  mkdirSync(dirname(bridgePath), { recursive: true });
  writeFileSync(bridgePath, BRIDGE_SCRIPT, 'utf8');
  return `node "${bridgePath}" claude-code "${endpoint}" "${token}" "${marker}"`;
}

function readSettings(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>; }
  catch { return {}; }
}

function writeSettings(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

function fallbackSessionId(data: Record<string, unknown>): string {
  return String(data.transcript_path ?? data.cwd ?? Date.now()).slice(0, 32);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n) + '...' : s; }

const BRIDGE_SCRIPT = `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
const [, , agent, endpoint, token, marker] = process.argv;
async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}
function post(u, t, b) {
  return new Promise((resolve, reject) => {
    const url = new URL(u), body = Buffer.from(JSON.stringify(b), 'utf8');
    const req = request({ method:'POST', hostname:url.hostname, port:url.port, path:url.pathname,
      headers:{ authorization:\`Bearer \${t}\`, 'content-type':'application/json', 'content-length':body.length },
      timeout: 1500 }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end(body);
  });
}
try {
  const rawText = await readStdin();
  const raw = rawText.trim() ? JSON.parse(rawText) : {};
  await post(endpoint, token, { agent, raw, receivedAt: new Date().toISOString() });
} catch { process.exit(0); }
`;
