import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentTaskStore } from '../src/main/agent/agentTaskStore';

describe('AgentTaskStore', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-agent-test-')));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates simulator tasks', () => {
    const store = new AgentTaskStore(join(dir, 'create.json'));
    const task = store.create({ title: '跑测试', agent: 'trae' });

    expect(task.source).toBe('simulator');
    expect(task.status).toBe('started');
    expect(store.list()[0]?.title).toBe('跑测试');
  });

  it('updates task status and completion time', () => {
    const store = new AgentTaskStore(join(dir, 'update.json'));
    const task = store.create({ title: '跑构建', agent: 'openclaw' });
    const updated = store.updateStatus({ id: task.id, status: 'completed' });

    expect(updated?.status).toBe('completed');
    expect(updated?.completedAt).toBeTruthy();
  });

  it('deletes tasks', () => {
    const store = new AgentTaskStore(join(dir, 'delete.json'));
    const task = store.create({ title: '清理日志', agent: 'terminal' });

    expect(store.delete(task.id)).toEqual([]);
  });

  it('upserts watcher tasks by agent session', () => {
    const store = new AgentTaskStore(join(dir, 'watcher.json'));
    const first = store.upsertWatcherTask({
      integrationId: 'claude-code:windows-user:c:/users/test',
      agent: 'claude-code',
      scope: 'windows-user',
      sessionId: 'session-1',
      title: '实现 Hook',
      status: 'running'
    });
    const second = store.upsertWatcherTask({
      integrationId: 'claude-code:windows-user:c:/users/test',
      agent: 'claude-code',
      scope: 'windows-user',
      sessionId: 'session-1',
      title: '实现 Hook',
      status: 'completed',
      message: 'done'
    });

    expect(first.id).toBe(second.id);
    expect(second.source).toBe('watcher');
    expect(second.completedAt).toBeTruthy();
    expect(store.list()).toHaveLength(1);
  });
});
