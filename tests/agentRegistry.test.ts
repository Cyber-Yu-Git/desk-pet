/**
 * Agent Registry & Adapter BDD 测试
 */
import { describe, expect, it } from 'vitest';
import { agentRegistry } from '../src/main/agent/agentRegistry';
import { claudeAdapter } from '../src/main/agent/adapters/claudeAdapter';
import { openclawAdapter } from '../src/main/agent/adapters/openclawAdapter';
import { opencodeAdapter } from '../src/main/agent/adapters/opencodeAdapter';
import { hermesAdapter } from '../src/main/agent/adapters/hermesAdapter';
import type { AgentAdapter } from '../src/main/agent/adapter';

function resetRegistry(): void {
  // AgentRegistry 是单例，测试间需要重置
  for (const a of agentRegistry.list()) {
    (agentRegistry as unknown as Record<string, Map<string, unknown>>)['adapters']?.delete(a.kind);
  }
}

describe('AgentRegistry', () => {
  it('注册 adapter 后可通过 kind 查询', () => {
    resetRegistry();
    agentRegistry.register(claudeAdapter);
    agentRegistry.register(openclawAdapter);

    expect(agentRegistry.get('claude-code')).toBeDefined();
    expect(agentRegistry.get('openclaw')).toBeDefined();
    expect(agentRegistry.get('codex')).toBeUndefined();
    expect(agentRegistry.list()).toHaveLength(2);
  });
});

describe('Claude Adapter', () => {
  it('Stop → completed', () => {
    const n = claudeAdapter.normalize({ hook_event_name: 'Stop', session_id: 's1', cwd: '/tmp' });
    expect(n.status).toBe('completed');
    expect(n.priority).toBe('high');
  });

  it('Notification(permission) → waiting_permission', () => {
    const n = claudeAdapter.normalize({ hook_event_name: 'Notification', message: 'Claude needs permission' });
    expect(n.status).toBe('waiting_permission');
  });

  it('StopFailure → failed', () => {
    const n = claudeAdapter.normalize({ hook_event_name: 'StopFailure' });
    expect(n.status).toBe('failed');
  });

  it('UserPromptSubmit → started, 用 prompt 做标题', () => {
    const n = claudeAdapter.normalize({ hook_event_name: 'UserPromptSubmit', prompt: '帮我重构' });
    expect(n.status).toBe('started');
    expect(n.title).toBe('帮我重构');
  });

  it('discover 返回本机和 WSL 路径', () => {
    const list = claudeAdapter.discover();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.settingsPath).toContain('.claude');
  });
});

describe('OpenClaw Adapter', () => {
  it('done → completed', () => {
    const n = openclawAdapter.normalize({ status: 'done', session_id: 's2' });
    expect(n.status).toBe('completed');
  });

  it('error → failed', () => {
    const n = openclawAdapter.normalize({ status: 'error', message: 'crash' });
    expect(n.status).toBe('failed');
  });

  it('active → running', () => {
    const n = openclawAdapter.normalize({ status: 'active' });
    expect(n.status).toBe('running');
  });

  it('discover 返回 .openclaw 路径', () => {
    const list = openclawAdapter.discover();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.settingsPath).toContain('.openclaw');
  });
});

describe('OpenCode Adapter', () => {
  it('done → completed', () => {
    const n = opencodeAdapter.normalize({ status: 'done' });
    expect(n.status).toBe('completed');
  });

  it('error → failed', () => {
    const n = opencodeAdapter.normalize({ status: 'error' });
    expect(n.status).toBe('failed');
  });

  it('未知状态 → running', () => {
    const n = opencodeAdapter.normalize({ status: 'unknown' });
    expect(n.status).toBe('running');
  });

  it('discover 返回 .config/opencode 路径', () => {
    const list = opencodeAdapter.discover();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.settingsPath).toContain('opencode');
  });
});

describe('Hermes Adapter', () => {
  it('completed → completed', () => {
    const n = hermesAdapter.normalize({ status: 'completed' });
    expect(n.status).toBe('completed');
  });

  it('failed → failed', () => {
    const n = hermesAdapter.normalize({ status: 'failed' });
    expect(n.status).toBe('failed');
  });

  it('discover 返回 .hermes 和 .config/hermes 两条路径', () => {
    const list = hermesAdapter.discover();
    expect(list.length).toBe(2);
    expect(list.some(p => p.settingsPath.includes('.hermes'))).toBe(true);
    expect(list.some(p => p.settingsPath.includes('.config/hermes'))).toBe(true);
  });
});

describe('所有 Adapter 接口完整性', () => {
  const adapters: AgentAdapter[] = [claudeAdapter, openclawAdapter, opencodeAdapter, hermesAdapter];

  for (const a of adapters) {
    it(`${a.name}: kind/name/discover/install/remove/normalize/isInstalled 全部存在`, () => {
      expect(typeof a.kind).toBe('string');
      expect(typeof a.name).toBe('string');
      expect(typeof a.discover).toBe('function');
      expect(typeof a.install).toBe('function');
      expect(typeof a.remove).toBe('function');
      expect(typeof a.normalize).toBe('function');
      expect(typeof a.isInstalled).toBe('function');
    });

    it(`${a.name}: normalize 未知输入不抛异常`, () => {
      expect(() => a.normalize(null)).not.toThrow();
      expect(() => a.normalize(undefined)).not.toThrow();
      expect(() => a.normalize('string')).not.toThrow();
      expect(() => a.normalize(42)).not.toThrow();
      const n = a.normalize({});
      expect(n.status).toBeDefined();
      expect(n.sessionId).toBeDefined();
      expect(n.priority).toBeDefined();
    });
  }
});
