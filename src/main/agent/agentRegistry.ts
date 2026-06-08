/**
 * Agent Registry — 管理所有已注册的 AgentAdapter
 */
import type { AgentKind } from '../../shared/types';
import type { AgentAdapter, DiscoveredAgentInstallation, AgentInstallTarget, NormalizedAgentEvent } from './adapter';

class AgentRegistry {
  private adapters = new Map<AgentKind, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  get(kind: AgentKind): AgentAdapter | undefined {
    return this.adapters.get(kind);
  }

  list(): AgentAdapter[] {
    return [...this.adapters.values()];
  }

  discoverAll(): { kind: AgentKind; name: string; installations: DiscoveredAgentInstallation[] }[] {
    return this.list().map((a) => ({
      kind: a.kind,
      name: a.name,
      installations: a.discover()
    }));
  }

  install(kind: AgentKind, target: AgentInstallTarget, endpoint: string, token: string): void {
    this.adapters.get(kind)?.install(target, endpoint, token);
  }

  remove(kind: AgentKind, target: AgentInstallTarget): void {
    this.adapters.get(kind)?.remove(target);
  }

  normalize(kind: AgentKind, raw: unknown): NormalizedAgentEvent {
    const adapter = this.adapters.get(kind);
    if (adapter) return adapter.normalize(raw);
    // 兜底：尝试用第一个注册的 adapter
    return this.list()[0]?.normalize(raw) ?? {
      sessionId: 'unknown',
      title: 'Unknown Agent Event',
      status: 'running',
      priority: 'normal'
    };
  }
}

export const agentRegistry = new AgentRegistry();
