import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentIntegrationStore, buildIntegrationId } from '../src/main/agent/agentIntegrationStore';

describe('AgentIntegrationStore', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-integration-test-')));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('upserts integrations by agent scope and path', () => {
    const store = new AgentIntegrationStore(join(dir, 'integrations.json'));
    const first = store.upsert({
      agent: 'claude-code',
      scope: 'windows-user',
      scopePath: 'C:\\Users\\Test',
      settingsPath: 'C:\\Users\\Test\\.claude\\settings.json',
      command: 'node bridge.mjs',
      enabled: true,
      installed: true
    });
    const second = store.upsert({
      agent: 'claude-code',
      scope: 'windows-user',
      scopePath: 'C:/Users/Test/',
      settingsPath: 'C:\\Users\\Test\\.claude\\settings.json',
      command: 'node bridge.mjs',
      enabled: true,
      installed: true
    });

    expect(first.id).toBe(second.id);
    expect(store.list()).toHaveLength(1);
  });

  it('tracks last event time independently from install state', () => {
    const store = new AgentIntegrationStore(join(dir, 'events.json'));
    const integration = store.upsert({
      agent: 'claude-code',
      scope: 'windows-project',
      scopePath: 'C:\\repo',
      settingsPath: 'C:\\repo\\.claude\\settings.local.json',
      command: 'node bridge.mjs',
      enabled: true,
      installed: true
    });
    const updated = store.markEventReceived(integration.id, '2026-06-01T00:00:00.000Z');

    expect(updated?.lastEventAt).toBe('2026-06-01T00:00:00.000Z');
    expect(updated?.installed).toBe(true);
  });

  it('builds stable integration ids', () => {
    expect(buildIntegrationId('claude-code', 'windows-project', 'C:\\Repo\\')).toBe(
      buildIntegrationId('claude-code', 'windows-project', 'c:/repo')
    );
  });
});
