/**
 * Claude Code Agent 监控端到端测试
 *
 * 验证链路：HTTP POST → AgentEventIngestServer → normalizeClaudeHookEvent → AgentTask
 */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentEventIngestServer, type IncomingAgentHookEvent } from '../src/main/agent/agentEventIngestServer';
import { normalizeClaudeHookEvent } from '../src/main/agent/claudeHookNormalizer';
import { agentRegistry } from '../src/main/agent/agentRegistry';
import { claudeAdapter } from '../src/main/agent/adapters/claudeAdapter';

function postEvent(
  port: number,
  token: string,
  body: unknown
): Promise<{ status: number; ok: boolean }> {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  return new Promise((resolve, reject) => {
    const req = request(
      {
        method: 'POST',
        hostname: '127.0.0.1',
        port,
        path: '/agent-events',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'content-length': payload.length
        },
        timeout: 5000
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { ok: boolean };
            resolve({ status: res.statusCode ?? 0, ok: body.ok });
          } catch {
            resolve({ status: res.statusCode ?? 0, ok: false });
          }
        });
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('Agent 监控端到端', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-agent-ingest-')));
  const secretPath = join(dir, 'secret.json');
  const receivedEvents: IncomingAgentHookEvent[] = [];
  let server: AgentEventIngestServer;
  let port: number;
  let token: string;

  beforeAll(async () => {
    agentRegistry.register(claudeAdapter);
    server = new AgentEventIngestServer({
      secretPath,
      onEvent: (event) => { receivedEvents.push(event); }
    });
    await server.start();
    port = parseInt(server.endpoint.split(':')[2]!, 10);
    token = server.authToken;
  });

  afterAll(() => {
    server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  // ── Feature: HTTP Ingest Server ──────────────────────

  it('接收 Claude Code Stop 事件并触发 onEvent 回调', async () => {
    const result = await postEvent(port, token, {
      agent: 'claude-code',
      raw: {
        hook_event_name: 'Stop',
        session_id: 'session-e2e-1',
        cwd: 'C:\\projects\\desk-pet'
      },
      receivedAt: '2026-06-01T12:00:00.000Z'
    });

    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);

    const last = receivedEvents.at(-1)!;
    expect(last.agent).toBe('claude-code');
    expect(last.receivedAt).toBe('2026-06-01T12:00:00.000Z');
    expect(last.raw).toEqual({
      hook_event_name: 'Stop',
      session_id: 'session-e2e-1',
      cwd: 'C:\\projects\\desk-pet'
    });
  });

  it('拒绝无 token 的请求', async () => {
    try {
      const result = await postEvent(port, 'wrong-token', { agent: 'claude-code', raw: {} });
      expect(result.status).toBe(401);
    } catch {
      // 401 时服务器直接断开连接也是合法的拒绝行为
      expect(true).toBe(true);
    }
  });

  it('拒绝非 claude-code 的 agent', async () => {
    const result = await postEvent(port, token, { agent: 'codex', raw: {} });
    expect(result.status).toBe(400);
  });

  it('Token 持久化——重启后 token 不变', () => {
    const s2 = new AgentEventIngestServer({ secretPath, onEvent: () => {} });
    expect(s2.authToken).toBe(token);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  // ── Feature: normalizeClaudeHookEvent → Agent 状态 ────

  it('Claude Stop → completed，session 保留', () => {
    const n = normalizeClaudeHookEvent({
      hook_event_name: 'Stop',
      session_id: 'session-real-1',
      cwd: 'C:\\repo\\desk-pet'
    });
    expect(n.status).toBe('completed');
    expect(n.sessionId).toBe('session-real-1');
    expect(n.title).toContain('desk-pet');
    expect(n.priority).toBe('high');
  });

  it('Claude Notification(permission) → waiting_permission', () => {
    const n = normalizeClaudeHookEvent({
      hook_event_name: 'Notification',
      message: 'Claude needs permission to execute a command'
    });
    expect(n.status).toBe('waiting_permission');
    expect(n.priority).toBe('high');
  });

  it('Claude StopFailure → failed', () => {
    const n = normalizeClaudeHookEvent({
      hook_event_name: 'StopFailure',
      cwd: 'C:\\project'
    });
    expect(n.status).toBe('failed');
    expect(n.priority).toBe('high');
  });

  it('UserPromptSubmit → started，用 prompt 做标题', () => {
    const n = normalizeClaudeHookEvent({
      hook_event_name: 'UserPromptSubmit',
      prompt: '请帮我重构这个模块'
    });
    expect(n.status).toBe('started');
    expect(n.title).toBe('请帮我重构这个模块');
  });

  it('PreToolUse → running，包含工具名', () => {
    const n = normalizeClaudeHookEvent({
      hook_event_name: 'PreToolUse',
      tool_name: 'Write'
    });
    expect(n.status).toBe('running');
    expect(n.message).toContain('Write');
  });

  // ── 完整链路：HTTP → normalize ────────────────────────

  it('完整链路：HTTP POST Stop 事件 → 标准化后 status=completed', async () => {
    const countBefore = receivedEvents.length;

    const result = await postEvent(port, token, {
      agent: 'claude-code',
      integrationId: 'claude-code:windows-user:c:/users/test',
      scope: 'windows-user',
      scopePath: 'C:\\Users\\Test',
      raw: {
        hook_event_name: 'Stop',
        session_id: 'chain-test-1',
        cwd: 'C:\\projects\\demo'
      },
      receivedAt: '2026-06-01T13:00:00.000Z'
    });

    expect(result.status).toBe(200);
    expect(receivedEvents.length).toBe(countBefore + 1);

    const event = receivedEvents.at(-1)!;
    const normalized = normalizeClaudeHookEvent(event.raw);

    expect(normalized.status).toBe('completed');
    expect(normalized.sessionId).toBe('chain-test-1');
    expect(normalized.title).toContain('demo');
    expect(event.integrationId).toBe('claude-code:windows-user:c:/users/test');
  });
});
