/**
 * Hermes Adapter — 热门开源 AI Agent 框架
 *
 * 配置文件通常在 ~/.hermes/ 或 ~/.config/hermes/
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentAdapter, AgentInstallTarget, DiscoveredAgentInstallation, NormalizedAgentEvent } from '../adapter';

export const hermesAdapter: AgentAdapter = {
  kind: 'hermes' as never, // TODO: 添加到 AgentKind
  name: 'Hermes',

  discover(): DiscoveredAgentInstallation[] {
    const home = homedir();
    const paths = [
      join(home, '.hermes', 'config.json'),
      join(home, '.config', 'hermes', 'config.json')
    ];
    return paths.map(p => ({
      label: `Hermes — ${p}`,
      settingsPath: p,
      scope: (process.platform === 'win32' ? 'windows-user' : 'linux-user') as AgentInstallTarget['scope'],
      scopePath: home,
      exists: existsSync(p),
      source: 'native' as const
    })).sort((a, b) => (b.exists ? 1 : 0) - (a.exists ? 1 : 0));
  },

  install(_target: AgentInstallTarget, _endpoint: string, _token: string): void {
    // Hermes 通过进程检测实现
  },

  remove(_target: AgentInstallTarget): void {},

  normalize(raw: unknown): NormalizedAgentEvent {
    const data = asRecord(raw) ?? {};
    const status = String(data.status ?? 'running');
    return {
      sessionId: String(data.session_id ?? data.id ?? Date.now()),
      title: String(data.title ?? 'Hermes Task'),
      status: status === 'completed' || status === 'done' ? 'completed'
        : status === 'failed' || status === 'error' ? 'failed'
        : status === 'waiting' ? 'waiting_permission'
        : 'running',
      message: String(data.message ?? '') || undefined,
      projectPath: String(data.cwd ?? '') || undefined,
      priority: status === 'completed' || status === 'failed' ? 'high' : 'normal'
    };
  },

  isInstalled(target: AgentInstallTarget): boolean {
    return existsSync(target.settingsPath);
  }
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
}
