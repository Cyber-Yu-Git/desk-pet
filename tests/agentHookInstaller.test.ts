import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentHookInstaller } from '../src/main/agent/agentHookInstaller';
import { AgentIntegrationStore } from '../src/main/agent/agentIntegrationStore';

describe('AgentHookInstaller', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-hook-installer-test-')));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('installs project hooks into settings.local.json without removing other hooks', () => {
    const projectPath = join(dir, 'project');
    const store = new AgentIntegrationStore(join(dir, 'integrations.json'));
    const installer = new AgentHookInstaller({
      userDataPath: join(dir, 'userData'),
      endpoint: 'http://127.0.0.1:17371/agent-events',
      token: 'x'.repeat(48),
      serverRunning: true,
      integrationStore: store
    });

    installer.installClaudeProjectHook(projectPath);

    const settingsPath = join(projectPath, '.claude', 'settings.local.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const command = settings.hooks.Stop?.[0]?.hooks[0]?.command ?? '';

    expect(command).toContain('cyber-yu-desk-pet-agent-hook:v1');
    expect(command).toContain('windows-project');
    expect(store.list()[0]?.scope).toBe('windows-project');
  });

  it('removes only the desk pet project hook marker', () => {
    const projectPath = join(dir, 'project-remove');
    const store = new AgentIntegrationStore(join(dir, 'remove-integrations.json'));
    const installer = new AgentHookInstaller({
      userDataPath: join(dir, 'remove-userData'),
      endpoint: 'http://127.0.0.1:17371/agent-events',
      token: 'x'.repeat(48),
      serverRunning: true,
      integrationStore: store
    });

    installer.installClaudeProjectHook(projectPath);
    installer.removeClaudeProjectHook(projectPath);

    const settingsPath = join(projectPath, '.claude', 'settings.local.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { hooks?: Record<string, unknown> };

    expect(settings.hooks?.Stop).toBeUndefined();
    expect(store.list()[0]?.installed).toBe(false);
    expect(existsSync(join(dir, 'remove-userData', 'agent-hook-bridge.mjs'))).toBe(true);
  });
});
