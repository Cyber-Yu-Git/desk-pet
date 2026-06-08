/**
 * OpenClaw Adapter — 小龙虾
 *
 * 通过监听 ~/.openclaw/ 目录下的会话日志来判断状态。
 * 无原生 Hook 机制，采用日志尾随策略。
 */
import { existsSync } from 'node:fs';
import type { AgentAdapter, AgentInstallTarget, DiscoveredAgentInstallation, NormalizedAgentEvent } from '../adapter';
import { discoverNativeAndWsl } from '../discovery';

export const openclawAdapter: AgentAdapter = {
  kind: 'openclaw',
  name: 'OpenClaw',

  discover(): DiscoveredAgentInstallation[] {
    return discoverNativeAndWsl('.openclaw', 'config.json');
  },

  install(target: AgentInstallTarget, _endpoint: string, _token: string): void {
    // OpenClaw 通过日志尾随实现，无需修改配置文件
    // 标记 config 目录存在即可
    if (!existsSync(target.settingsPath)) {
      throw new Error(`OpenClaw 配置目录不存在: ${target.settingsPath}`);
    }
  },

  remove(_target: AgentInstallTarget): void {
    // 无需清理
  },

  normalize(raw: unknown): NormalizedAgentEvent {
    const data = asRecord(raw) ?? {};
    const status = String(data.status ?? '');
    const message = String(data.message ?? '');
    const sessionId = String(data.session_id ?? data.id ?? Date.now());

    return {
      sessionId,
      title: String(data.title ?? 'OpenClaw Task'),
      status: mapOpenClawStatus(status),
      message: message || undefined,
      projectPath: String(data.cwd ?? data.project ?? '') || undefined,
      priority: status === 'completed' || status === 'error' ? 'high' : 'normal'
    };
  },

  isInstalled(target: AgentInstallTarget): boolean {
    return existsSync(target.settingsPath);
  }
};

function mapOpenClawStatus(s: string): NormalizedAgentEvent['status'] {
  if (s === 'running' || s === 'active') return 'running';
  if (s === 'completed' || s === 'done') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'waiting' || s === 'paused') return 'waiting_permission';
  return 'running';
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
}
