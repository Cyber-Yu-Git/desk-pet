/**
 * OpenCode Adapter
 *
 * 通过 ~/.config/opencode/ 配置目录发现。
 * 采用进程检测 + 日志尾随策略。
 */
import { existsSync } from 'node:fs';
import type { AgentAdapter, AgentInstallTarget, DiscoveredAgentInstallation, NormalizedAgentEvent } from '../adapter';
import { discoverNativeAndWsl } from '../discovery';

export const opencodeAdapter: AgentAdapter = {
  kind: 'opencode' as never, // TODO: 添加到 AgentKind
  name: 'OpenCode',

  discover(): DiscoveredAgentInstallation[] {
    return discoverNativeAndWsl('.config/opencode', 'config.yaml');
  },

  install(_target: AgentInstallTarget, _endpoint: string, _token: string): void {
    // OpenCode 通过进程检测实现，无需修改配置文件
  },

  remove(_target: AgentInstallTarget): void {
    // 无需清理
  },

  normalize(raw: unknown): NormalizedAgentEvent {
    const data = asRecord(raw) ?? {};
    const status = String(data.status ?? 'running');
    return {
      sessionId: String(data.session_id ?? data.id ?? Date.now()),
      title: String(data.title ?? 'OpenCode Task'),
      status: mapStatus(status),
      message: String(data.message ?? '') || undefined,
      projectPath: String(data.cwd ?? '') || undefined,
      priority: status === 'completed' || status === 'error' ? 'high' : 'normal'
    };
  },

  isInstalled(target: AgentInstallTarget): boolean {
    return existsSync(target.settingsPath);
  }
};

function mapStatus(s: string): NormalizedAgentEvent['status'] {
  if (s === 'completed' || s === 'done') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'waiting' || s === 'paused') return 'waiting_permission';
  return 'running';
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
}
