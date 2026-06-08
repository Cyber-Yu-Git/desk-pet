/**
 * 跨平台安装位置发现工具
 * Windows / WSL / Linux 通用
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DiscoveredAgentInstallation } from './adapter';

/** 扫描本机 + WSL 发行版中的某工具配置目录 */
export function discoverNativeAndWsl(configDir: string, configFile: string): DiscoveredAgentInstallation[] {
  const results: DiscoveredAgentInstallation[] = [];
  const home = homedir();
  const isWin = process.platform === 'win32';

  results.push({
    label: isWin ? `Windows — ${home}` : `Linux — ${home}`,
    settingsPath: join(home, configDir, configFile),
    scope: isWin ? 'windows-user' : 'linux-user',
    scopePath: home,
    exists: existsSync(join(home, configDir, configFile)),
    source: 'native'
  });

  if (isWin) {
    results.push(...discoverWsl(configDir, configFile));
  }

  results.sort((a, b) => (b.exists ? 1 : 0) - (a.exists ? 1 : 0));
  return results;
}

function discoverWsl(configDir: string, configFile: string): DiscoveredAgentInstallation[] {
  const results: DiscoveredAgentInstallation[] = [];
  try {
    const raw = execFileSync('wsl.exe', ['-l', '-q'], { encoding: 'buffer', timeout: 5000, windowsHide: true });
    const distros = stripNullBytes(raw.toString('utf16le'))
      .split(/[\r\n]+/).map(l => l.trim()).filter(l => l && !l.includes('docker-desktop'));
    for (const d of distros) {
      const home = resolveWslHome(d);
      if (!home) continue;
      const path = joinWsl(d, home, configDir, configFile);
      results.push({
        label: `WSL (${d}) — ${home}`,
        settingsPath: path,
        scope: 'wsl-user',
        scopePath: joinWsl(d, home),
        exists: existsSync(path),
        source: 'wsl'
      });
    }
  } catch { /* wsl.exe 不可用 */ }
  return results;
}

function stripNullBytes(s: string): string { return s.replace(/\0/g, ''); }

function resolveWslHome(distro: string): string | null {
  try {
    const raw = execFileSync('wsl.exe', ['-d', distro, '--', 'echo', '$HOME'], { encoding: 'buffer', timeout: 5000, windowsHide: true });
    const out = raw.toString('utf8').trim();
    return out || null;
  } catch { return null; }
}

function joinWsl(distro: string, ...parts: string[]): string {
  return `\\\\wsl$\\${distro}${join(...parts).replace(/\//g, '\\')}`;
}
