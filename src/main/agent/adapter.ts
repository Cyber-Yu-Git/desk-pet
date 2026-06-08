/**
 * Agent Adapter 抽象接口
 *
 * 每个 AI Agent 工具实现此接口后注册到 AgentRegistry，
 * IngestServer / Discover / Install / Normalize 全部通过 Adapter 调用。
 */
import type { AgentIntegrationScope, AgentKind, AgentStatus } from '../../shared/types';

export interface DiscoveredAgentInstallation {
  label: string;
  settingsPath: string;
  scope: AgentIntegrationScope;
  scopePath: string;
  exists: boolean;
  source: 'native' | 'wsl';
}

export interface AgentInstallTarget {
  settingsPath: string;
  scope: AgentIntegrationScope;
  scopePath: string;
}

export interface NormalizedAgentEvent {
  sessionId: string;
  title: string;
  status: AgentStatus;
  message?: string;
  projectPath?: string;
  priority: 'low' | 'normal' | 'high';
}

export interface AgentAdapter {
  /** AgentKind 枚举值 */
  kind: AgentKind;
  /** 显示名 */
  name: string;
  /** 扫描本机安装位置 */
  discover(): DiscoveredAgentInstallation[];
  /** 安装 hook/监听 */
  install(target: AgentInstallTarget, ingestEndpoint: string, ingestToken: string): void;
  /** 移除 hook/监听 */
  remove(target: AgentInstallTarget): void;
  /** 将原始事件转为标准格式 */
  normalize(raw: unknown): NormalizedAgentEvent;
  /** 检查是否已安装 */
  isInstalled(target: AgentInstallTarget): boolean;
}
