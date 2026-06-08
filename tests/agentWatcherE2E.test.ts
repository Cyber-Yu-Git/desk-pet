/**
 * Agent Watcher 完整链路端到端测试
 *
 * 从 HTTP 事件到 AgentTask + emitPetState 的完整验证。
 * 不 mock 任何内部模块，全部使用真实 Store 和 Normalizer。
 */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AgentEventIngestServer } from '../src/main/agent/agentEventIngestServer';
import { AgentIntegrationStore } from '../src/main/agent/agentIntegrationStore';
import { AgentTaskStore } from '../src/main/agent/agentTaskStore';
import { agentRegistry } from '../src/main/agent/agentRegistry';
import { claudeAdapter } from '../src/main/agent/adapters/claudeAdapter';
import { normalizeClaudeHookEvent } from '../src/main/agent/claudeHookNormalizer';
import type { PetState } from '../src/shared/types';

// ---------------------------------------------------------------------------
// 测试用 emitPetState 收集器（替代真实的 BrowserWindow.webContents.send）
// ---------------------------------------------------------------------------
interface EmittedPetState {
  state: PetState;
  reason: string;
  priority: 'low' | 'normal' | 'high';
}

function collectPetStates(): {
  states: EmittedPetState[];
  emit: (state: PetState, reason: string, priority?: 'low' | 'normal' | 'high') => void;
} {
  const states: EmittedPetState[] = [];
  return {
    states,
    emit(state, reason, priority = 'normal') {
      states.push({ state, reason, priority });
    }
  };
}

// ---------------------------------------------------------------------------
// 复制 handleAgentHookEvent 的核心逻辑（无 Electron 依赖）
// ---------------------------------------------------------------------------
function processAgentHookEvent(
  event: Parameters<typeof normalizeClaudeHookEvent>[0] extends infer T ? T : never,
  deps: {
    agentTaskStore: AgentTaskStore;
    agentIntegrationStore: AgentIntegrationStore;
    emitPetState: (state: PetState, reason: string, priority?: 'low' | 'normal' | 'high') => void;
    integrationId?: string;
    scope?: string;
  }
) {
  const normalized = normalizeClaudeHookEvent(event.raw ?? event);
  const integration = deps.integrationId
    ? deps.agentIntegrationStore.findById(deps.integrationId)
    : undefined;
  const scope = (integration?.scope ?? deps.scope ?? 'windows-user') as Parameters<typeof deps.agentTaskStore.upsertWatcherTask>[0]['scope'];
  const integrationId =
    integration?.id ??
    deps.integrationId ??
    `external:claude-code:${scope}`;

  if (integration) {
    deps.agentIntegrationStore.markEventReceived(integration.id, new Date().toISOString());
  }

  const task = deps.agentTaskStore.upsertWatcherTask({
    integrationId,
    agent: 'claude-code',
    scope,
    sessionId: normalized.sessionId,
    title: normalized.title,
    status: normalized.status,
    message: normalized.message,
    projectPath: normalized.projectPath
  });

  const petState = mapAgentStatusToPetState(task.status);
  deps.emitPetState(petState, `agent-hook:${task.agent}:${task.status}`, normalized.priority);

  return { task, normalized, petState };
}

function mapAgentStatusToPetState(status: string): PetState {
  switch (status) {
    case 'started':
    case 'running':
      return 'working';
    case 'waiting_permission':
    case 'idle_too_long':
      return 'waiting';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'idle';
  }
}

// ---------------------------------------------------------------------------
// HTTP 请求工具
// ---------------------------------------------------------------------------
function postEvent(port: number, token: string, body: unknown): Promise<{ status: number; ok: boolean }> {
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
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode ?? 0, ok: (JSON.parse(Buffer.concat(chunks).toString('utf8')) as { ok: boolean }).ok }); }
          catch { resolve({ status: res.statusCode ?? 0, ok: false }); }
        });
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('Agent Watcher 完整链路', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-e2e-')));
  const secretPath = join(dir, 'secret.json');
  const collector = collectPetStates();
  let agentIntegrationStore: AgentIntegrationStore;
  let agentTaskStore: AgentTaskStore;
  let server: AgentEventIngestServer;
  let port: number;
  let token: string;

  beforeAll(async () => {
    agentRegistry.register(claudeAdapter);
    agentIntegrationStore = new AgentIntegrationStore(join(dir, 'integrations.json'));
    agentTaskStore = new AgentTaskStore(join(dir, 'tasks.json'));

    server = new AgentEventIngestServer({
      secretPath,
      onEvent: (event) => {
        processAgentHookEvent(event.raw as Record<string, unknown>, {
          agentTaskStore,
          agentIntegrationStore,
          emitPetState: collector.emit,
          integrationId: event.integrationId,
          scope: event.scope
        });
      }
    });
    await server.start();
    port = parseInt(server.endpoint.split(':')[2]!, 10);
    token = server.authToken;
  });

  afterAll(() => {
    server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    collector.states.length = 0;
  });

  // ── SCENARIO 1: Claude 完成任务 ─────────────────────

  it('Claude Stop → AgentTask completed → emit success(high)', async () => {
    const result = await postEvent(port, token, {
      agent: 'claude-code',
      integrationId: 'claude-code:windows-user:c:/users/demo',
      scope: 'windows-user',
      scopePath: 'C:\\Users\\Demo',
      raw: {
        hook_event_name: 'Stop',
        session_id: 'session-complete-1',
        cwd: 'C:\\projects\\my-app'
      },
      receivedAt: '2026-06-01T14:00:00.000Z'
    });

    expect(result.status).toBe(200);

    // 验证 AgentTask 写入
    const tasks = agentTaskStore.list();
    const task = tasks.find((t) => t.sessionId === 'session-complete-1');
    expect(task).toBeDefined();
    expect(task!.status).toBe('completed');
    expect(task!.source).toBe('watcher');
    expect(task!.title).toContain('my-app');
    expect(task!.agent).toBe('claude-code');

    // 验证 emitPetState
    expect(collector.states.length).toBeGreaterThanOrEqual(1);
    const last = collector.states.at(-1)!;
    expect(last.state).toBe('success');
    expect(last.reason).toContain('agent-hook:claude-code:completed');
    expect(last.priority).toBe('high');
  });

  // ── SCENARIO 2: Claude 等待权限确认 ─────────────────

  it('Claude Notification(permission) → waiting → emit waiting(high)', async () => {
    await postEvent(port, token, {
      agent: 'claude-code',
      integrationId: 'claude-code:windows-user:c:/users/demo',
      scope: 'windows-user',
      scopePath: 'C:\\Users\\Demo',
      raw: {
        hook_event_name: 'Notification',
        session_id: 'session-permission-2',
        message: 'Claude needs permission to run a bash command',
        cwd: 'C:\\projects\\my-app'
      },
      receivedAt: '2026-06-01T14:01:00.000Z'
    });

    const tasks = agentTaskStore.list();
    const task = tasks.find((t) => t.sessionId === 'session-permission-2');
    expect(task).toBeDefined();
    expect(task!.status).toBe('waiting_permission');

    const last = collector.states.at(-1)!;
    expect(last.state).toBe('waiting');
    expect(last.priority).toBe('high');
  });

  // ── SCENARIO 3: Claude 失败 ─────────────────────────

  it('Claude StopFailure → failed → emit error(high)', async () => {
    await postEvent(port, token, {
      agent: 'claude-code',
      integrationId: 'claude-code:windows-user:c:/users/demo',
      scope: 'windows-user',
      scopePath: 'C:\\Users\\Demo',
      raw: {
        hook_event_name: 'StopFailure',
        session_id: 'session-fail-3',
        cwd: 'C:\\projects\\my-app'
      },
      receivedAt: '2026-06-01T14:02:00.000Z'
    });

    const tasks = agentTaskStore.list();
    const task = tasks.find((t) => t.sessionId === 'session-fail-3');
    expect(task!.status).toBe('failed');

    const last = collector.states.at(-1)!;
    expect(last.state).toBe('error');
    expect(last.priority).toBe('high');
  });

  // ── SCENARIO 4: start → running → complete 完整会话 ──

  it('完整会话：UserPromptSubmit → PreToolUse → Stop', async () => {
    const sessionId = 'session-lifecycle-4';

    // 用户发起
    await postEvent(port, token, {
      agent: 'claude-code',
      scope: 'windows-user',
      raw: {
        hook_event_name: 'UserPromptSubmit',
        session_id: sessionId,
        prompt: '帮我写个测试',
        cwd: 'C:\\projects\\app'
      },
      receivedAt: '2026-06-01T15:00:00.000Z'
    });

    // 工具调用
    await postEvent(port, token, {
      agent: 'claude-code',
      scope: 'windows-user',
      raw: {
        hook_event_name: 'PreToolUse',
        session_id: sessionId,
        tool_name: 'Write',
        cwd: 'C:\\projects\\app'
      },
      receivedAt: '2026-06-01T15:00:05.000Z'
    });

    // 完成
    await postEvent(port, token, {
      agent: 'claude-code',
      scope: 'windows-user',
      raw: {
        hook_event_name: 'Stop',
        session_id: sessionId,
        cwd: 'C:\\projects\\app'
      },
      receivedAt: '2026-06-01T15:00:10.000Z'
    });

    // 验证同一个 session 被 upsert 而非创建多条
    const tasks = agentTaskStore.list();
    const sessionTasks = tasks.filter((t) => t.sessionId === sessionId);
    expect(sessionTasks).toHaveLength(1);
    expect(sessionTasks[0]!.status).toBe('completed');
    expect(sessionTasks[0]!.source).toBe('watcher');

    // 验证 emit 序列
    const stateSequence = collector.states.map((s) => s.state);
    expect(stateSequence).toContain('working');  // UserPromptSubmit → started → working
    expect(stateSequence).toContain('success');  // Stop → completed → success
    expect(stateSequence.at(-1)).toBe('success');
  });

  // ── SCENARIO 5: integration lastEventAt 更新 ───────

  it('HTTP 事件到达后 integration.lastEventAt 被更新', async () => {
    // 先注册一个 integration
    const integration = agentIntegrationStore.upsert({
      agent: 'claude-code',
      scope: 'windows-user',
      scopePath: 'C:\\Users\\E2E',
      settingsPath: 'C:\\Users\\E2E\\.claude\\settings.json',
      command: 'node bridge.mjs',
      enabled: true,
      installed: true
    });

    const before = integration.lastEventAt;

    await postEvent(port, token, {
      agent: 'claude-code',
      integrationId: integration.id,
      scope: 'windows-user',
      raw: {
        hook_event_name: 'Stop',
        session_id: 'session-tracked',
        cwd: 'C:\\Users\\E2E'
      },
      receivedAt: '2026-06-01T16:00:00.000Z'
    });

    const updated = agentIntegrationStore.findById(integration.id);
    expect(updated?.lastEventAt).not.toBe(before);
  });
});
