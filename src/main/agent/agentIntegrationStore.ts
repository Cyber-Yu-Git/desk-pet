import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentIntegration, AgentIntegrationScope, AgentKind } from '../../shared/types';

interface AgentIntegrationStoreData {
  integrations: AgentIntegration[];
}

export interface AgentIntegrationUpsertInput {
  agent: AgentKind;
  scope: AgentIntegrationScope;
  scopePath: string;
  settingsPath: string;
  command: string;
  enabled: boolean;
  installed: boolean;
}

export class AgentIntegrationStore {
  constructor(private readonly filePath: string) {}

  list(): AgentIntegration[] {
    return this.read().integrations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  findById(id: string): AgentIntegration | undefined {
    return this.read().integrations.find((integration) => integration.id === id);
  }

  findByAgentScope(agent: AgentKind, scope: AgentIntegrationScope, scopePath: string): AgentIntegration | undefined {
    const id = buildIntegrationId(agent, scope, scopePath);
    return this.findById(id);
  }

  upsert(input: AgentIntegrationUpsertInput): AgentIntegration {
    const data = this.read();
    const now = new Date().toISOString();
    const id = buildIntegrationId(input.agent, input.scope, input.scopePath);
    const existing = data.integrations.find((integration) => integration.id === id);
    const integration: AgentIntegration = {
      id,
      agent: input.agent,
      scope: input.scope,
      scopePath: input.scopePath,
      settingsPath: input.settingsPath,
      command: input.command,
      enabled: input.enabled,
      installed: input.installed,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      installedAt: input.installed ? existing?.installedAt ?? now : undefined,
      lastEventAt: existing?.lastEventAt
    };

    this.write({
      integrations: [integration, ...data.integrations.filter((item) => item.id !== id)].slice(0, 200)
    });
    return integration;
  }

  markRemoved(agent: AgentKind, scope: AgentIntegrationScope, scopePath: string): AgentIntegration | undefined {
    const data = this.read();
    const id = buildIntegrationId(agent, scope, scopePath);
    const now = new Date().toISOString();
    let removed: AgentIntegration | undefined;
    const integrations = data.integrations.map((integration) => {
      if (integration.id !== id) {
        return integration;
      }

      removed = {
        ...integration,
        enabled: false,
        installed: false,
        updatedAt: now
      };
      return removed;
    });

    if (!removed) {
      return undefined;
    }

    this.write({ integrations });
    return removed;
  }

  markEventReceived(id: string, receivedAt: string): AgentIntegration | undefined {
    const data = this.read();
    let updated: AgentIntegration | undefined;
    const integrations = data.integrations.map((integration) => {
      if (integration.id !== id) {
        return integration;
      }

      updated = {
        ...integration,
        lastEventAt: receivedAt,
        updatedAt: receivedAt
      };
      return updated;
    });

    if (!updated) {
      return undefined;
    }

    this.write({ integrations });
    return updated;
  }

  private read(): AgentIntegrationStoreData {
    if (!existsSync(this.filePath)) {
      return { integrations: [] };
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AgentIntegrationStoreData>;
      return {
        integrations: Array.isArray(parsed.integrations) ? parsed.integrations : []
      };
    } catch (error) {
      console.warn(`AgentIntegrationStore: 无法解析 ${this.filePath}，已重置`, error);
      return { integrations: [] };
    }
  }

  private write(data: AgentIntegrationStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

export function buildIntegrationId(agent: AgentKind, scope: AgentIntegrationScope, scopePath: string): string {
  return `${agent}:${scope}:${normalizeScopePath(scopePath)}`;
}

function normalizeScopePath(scopePath: string): string {
  return scopePath.trim().replace(/\\/g, '/').replace(/\/+$/g, '').toLowerCase();
}
