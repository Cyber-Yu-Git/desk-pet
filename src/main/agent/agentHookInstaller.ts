import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AgentHookStatus, AgentIntegration, AgentIntegrationScope } from '../../shared/types';
import { AgentIntegrationStore, buildIntegrationId } from './agentIntegrationStore';

const claudeHookEvents = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'StopFailure',
  'SubagentStop'
] as const;

const hookMarker = 'cyber-yu-desk-pet-agent-hook:v1';

interface AgentHookInstallerOptions {
  userDataPath: string;
  endpoint: string;
  token: string;
  serverRunning: boolean;
  integrationStore: AgentIntegrationStore;
  lastEventAt?: string;
}

interface ClaudeHookTarget {
  scope: AgentIntegrationScope;
  scopePath: string;
  settingsPath: string;
}

interface HookCommand {
  type?: string;
  command?: string;
}

interface HookMatcher {
  matcher?: string;
  hooks?: HookCommand[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

export class AgentHookInstaller {
  constructor(private readonly options: AgentHookInstallerOptions) {}

  getStatus(): AgentHookStatus {
    const target = this.getNativeUserTarget();
    this.refreshInstalledIntegrationConfigs();
    const installed = this.isClaudeHookInstalled(target);

    if (installed) {
      this.options.integrationStore.upsert({
        agent: 'claude-code',
        scope: target.scope,
        scopePath: target.scopePath,
        settingsPath: target.settingsPath,
        command: this.buildCommand(target),
        enabled: true,
        installed: true
      });
    }

    return {
      serverRunning: this.options.serverRunning,
      endpoint: this.options.endpoint,
      installed,
      settingsPath: target.settingsPath,
      bridgePath: 'inline',
      configPath: 'inline',
      command: this.buildCommand(target),
      lastEventAt: this.options.lastEventAt,
      integrations: this.options.integrationStore.list()
    };
  }

  installClaudeHook(settingsPath?: string, scope?: AgentIntegrationScope, scopePath?: string): AgentHookStatus {
    const target = settingsPath
      ? { settingsPath, scope: scope ?? 'windows-user', scopePath: scopePath ?? homedir() }
      : this.resolveBestTarget();
    this.installTarget(target);
    return this.getStatus();
  }

  removeClaudeHook(settingsPath?: string, scope?: AgentIntegrationScope, scopePath?: string): AgentHookStatus {
    const target = settingsPath
      ? { settingsPath, scope: scope ?? 'windows-user', scopePath: scopePath ?? homedir() }
      : this.resolveBestTarget();
    this.removeTarget(target);
    return this.getStatus();
  }

  /** 选择最合适的默认目标：优先已存在的 settings.json */
  private resolveBestTarget(): ClaudeHookTarget {
    const native = this.getNativeUserTarget();
    return existsSync(native.settingsPath) ? native : this.getNativeUserTarget();
  }

  private getNativeUserTarget(): ClaudeHookTarget {
    const home = homedir();
    return {
      scope: process.platform === 'win32' ? 'windows-user' : 'linux-user',
      scopePath: home,
      settingsPath: join(home, '.claude', 'settings.json')
    };
  }

  installClaudeProjectHook(projectPath: string): AgentIntegration {
    return this.installTarget(this.getWindowsProjectTarget(projectPath));
  }

  removeClaudeProjectHook(projectPath: string): AgentIntegration | undefined {
    return this.removeTarget(this.getWindowsProjectTarget(projectPath));
  }

  private installTarget(target: ClaudeHookTarget): AgentIntegration {
    const settings = this.readSettings(target.settingsPath, false);
    const hooks = settings.hooks ?? {};
    const command = { type: 'command', command: this.buildCommand(target) };

    for (const eventName of claudeHookEvents) {
      hooks[eventName] = removeDeskPetHooks(hooks[eventName] ?? [], target);
      hooks[eventName].push({ matcher: '', hooks: [command] });
    }

    settings.hooks = hooks;
    this.writeSettings(target.settingsPath, settings);

    return this.options.integrationStore.upsert({
      agent: 'claude-code',
      scope: target.scope,
      scopePath: target.scopePath,
      settingsPath: target.settingsPath,
      command: this.buildCommand(target),
      enabled: true,
      installed: true
    });
  }

  private removeTarget(target: ClaudeHookTarget): AgentIntegration | undefined {
    const settings = this.readSettings(target.settingsPath, false);
    const hooks = settings.hooks ?? {};

    for (const eventName of Object.keys(hooks)) {
      hooks[eventName] = removeDeskPetHooks(hooks[eventName] ?? [], target);

      if (hooks[eventName].length === 0) {
        delete hooks[eventName];
      }
    }

    settings.hooks = hooks;
    this.writeSettings(target.settingsPath, settings);
    return this.options.integrationStore.markRemoved('claude-code', target.scope, target.scopePath);
  }

  private getWindowsUserTarget(): ClaudeHookTarget {
    const scopePath = homedir();
    return {
      scope: 'windows-user',
      scopePath,
      settingsPath: join(scopePath, '.claude', 'settings.json')
    };
  }

  private getWindowsProjectTarget(projectPath: string): ClaudeHookTarget {
    return {
      scope: 'windows-project',
      scopePath: projectPath,
      settingsPath: join(projectPath, '.claude', 'settings.local.json')
    };
  }

  private buildCommand(target: ClaudeHookTarget): string {
    const endpoint = this.options.endpoint;
    const token = this.options.token;
    const marker = `${hookMarker}:${buildIntegrationId('claude-code', target.scope, target.scopePath)}`;
    return `node -e "import{request}from'node:http';const e='${endpoint}',t='${token}';const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{const b=Buffer.concat(c).toString(),p=b.trim()?JSON.parse(b):{};const u=new URL(e),body=Buffer.from(JSON.stringify({agent:'claude-code',raw:p,receivedAt:new Date().toISOString()})),r=request({method:'POST',hostname:u.hostname,port:u.port,path:u.pathname,headers:{authorization:'Bearer '+t,'content-type':'application/json','content-length':body.length},timeout:2000},res=>{res.resume();res.on('end',()=>process.exit(0))});r.on('error',()=>process.exit(0));r.on('timeout',()=>{r.destroy();process.exit(0)});r.end(body)})"`;
  }

  private refreshInstalledIntegrationConfigs(): void {
    for (const integration of this.options.integrationStore.list()) {
      if (integration.agent !== 'claude-code' || !integration.installed) {
        continue;
      }

      if (integration.scope === 'windows-user' || integration.scope === 'windows-project') {
        this.ensureConfigFile({
          scope: integration.scope,
          scopePath: integration.scopePath,
          settingsPath: integration.settingsPath
        });
      }
    }
  }

  private isClaudeHookInstalled(target: ClaudeHookTarget): boolean {
    const settings = this.readSettings(target.settingsPath, true);
    const hooks = settings.hooks ?? {};
    return Object.values(hooks).some((items) =>
      items.some((item) => item.hooks?.some((hook) => typeof hook.command === 'string' && hook.command.includes(hookMarker)))
    );
  }

  private readSettings(settingsPath: string, allowInvalid: boolean): ClaudeSettings {
    if (!existsSync(settingsPath)) {
      return {};
    }

    try {
      const raw = readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw) as ClaudeSettings;
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      if (allowInvalid) {
        return {};
      }

      throw new Error(`Claude Code 设置文件无法解析：${settingsPath}`);
    }
  }

  private writeSettings(settingsPath: string, settings: ClaudeSettings): void {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }
}

function removeDeskPetHooks(items: HookMatcher[], target: ClaudeHookTarget): HookMatcher[] {
  const marker = `${hookMarker}:${buildIntegrationId('claude-code', target.scope, target.scopePath)}`;

  return items
    .map((item) => ({
      ...item,
      hooks: item.hooks?.filter((hook) => {
        if (typeof hook.command !== 'string') {
          return true;
        }

        return !(hook.command.includes(marker) || isLegacyDeskPetHookForTarget(hook.command, target));
      }) ?? []
    }))
    .filter((item) => item.hooks && item.hooks.length > 0);
}

function isLegacyDeskPetHookForTarget(command: string, target: ClaudeHookTarget): boolean {
  return target.scope === 'windows-user' && command.includes('cyber-yu-desk-pet-agent-hook') && !command.includes(hookMarker);
}

function quoteArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 180);
}

/** \\\\wsl$\\Ubuntu-24.04\\home\\user → /home/user */
function toWslLinuxPath(uncPath: string): string {
  // \\wsl$\Distro\path → /path
  const withoutPrefix = uncPath.replace(/^\\\\wsl\$\\[^\\]+/, '');
  return withoutPrefix.replace(/\\/g, '/');
}

const bridgeScript = `#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { request as requestHttps } from 'node:https';

const [, , agent = 'claude-code', configPath] = process.argv;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function postJson(url, token, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const client = target.protocol === 'https:' ? requestHttps : request;
    const req = client(
      {
        method: 'POST',
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        headers: {
          authorization: \`Bearer \${token}\`,
          'content-type': 'application/json',
          'content-length': payload.length
        },
        timeout: 1200
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.statusCode);
          } else {
            reject(new Error(\`desk-pet hook returned \${res.statusCode}\`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('desk-pet hook timeout'));
    });
    req.end(payload);
  });
}

function writeDebug(configPath, fileName, body) {
  try {
    writeFileSync(join(dirname(configPath), fileName), JSON.stringify(body, null, 2), 'utf8');
  } catch {
    // Hook must never block Claude Code.
  }
}

try {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const rawText = await readStdin();
  const raw = rawText.trim() ? JSON.parse(rawText) : {};
  await postJson(config.endpoint, config.token, {
    agent,
    integrationId: config.integrationId,
    scope: config.scope,
    scopePath: config.scopePath,
    raw,
    receivedAt: new Date().toISOString()
  });
  writeDebug(configPath, 'last-ok.json', {
    integrationId: config.integrationId,
    endpoint: config.endpoint,
    receivedAt: new Date().toISOString()
  });
} catch (error) {
  writeDebug(configPath ?? '.', 'last-error.json', {
    message: error instanceof Error ? error.message : String(error),
    receivedAt: new Date().toISOString()
  });
  process.exit(0);
}
`;
