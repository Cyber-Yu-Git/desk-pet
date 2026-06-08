import type { EventName } from './eventNames';

export type PetState =
  | 'idle'
  | 'working'
  | 'reminding'
  | 'success'
  | 'error'
  | 'waiting'
  | 'sleeping'
  | 'sharing';

export type AgentStatus =
  | 'started'
  | 'running'
  | 'waiting_permission'
  | 'completed'
  | 'failed'
  | 'idle_too_long';

export type AgentKind = 'claude-code' | 'codex' | 'trae' | 'openclaw' | 'opencode' | 'hermes' | 'terminal';

export type AppPanel = 'chat' | 'todo' | 'agent' | 'memory' | 'share' | 'settings';

export type AgentIntegrationScope =
  | 'windows-user'
  | 'windows-project'
  | 'wsl-user'
  | 'wsl-project'
  | 'linux-user'
  | 'linux-project';

export interface AgentIntegration {
  id: string;
  agent: AgentKind;
  scope: AgentIntegrationScope;
  scopePath: string;
  settingsPath: string;
  enabled: boolean;
  installed: boolean;
  command: string;
  createdAt: string;
  updatedAt: string;
  installedAt?: string;
  lastEventAt?: string;
}

export interface AgentEvent {
  id: string;
  type: Extract<
    EventName,
    | 'agent.started'
    | 'agent.running'
    | 'agent.waiting_permission'
    | 'agent.completed'
    | 'agent.failed'
    | 'agent.idle_too_long'
  >;
  source: 'agent-watcher';
  agent: AgentKind;
  sessionId: string;
  status: AgentStatus;
  message?: string;
  projectPath?: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
}

export interface AgentTask {
  id: string;
  integrationId?: string;
  title: string;
  agent: AgentKind;
  scope?: AgentIntegrationScope;
  sessionId?: string;
  status: AgentStatus;
  message?: string;
  projectPath?: string;
  source: 'simulator' | 'watcher';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentTaskCreateInput {
  title: string;
  agent: AgentKind;
  projectPath?: string;
}

export interface AgentTaskUpdateStatusInput {
  id: string;
  status: AgentStatus;
  message?: string;
}

export interface DiscoveredClaudeCode {
  label: string;
  settingsPath: string;
  scope: AgentIntegrationScope;
  scopePath: string;
  exists: boolean;
  source: 'native' | 'wsl';
}

export interface AgentHookStatus {
  serverRunning: boolean;
  endpoint: string;
  installed: boolean;
  settingsPath: string;
  bridgePath: string;
  configPath: string;
  command: string;
  lastEventAt?: string;
  integrations: AgentIntegration[];
}

export interface PetEvent {
  type: 'pet.state.change';
  state: PetState;
  reason?: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSendInput {
  content: string;
}

export interface ChatSendResult {
  userMessage: ChatMessage;
  assistantMessage?: ChatMessage;
  messages: ChatMessage[];
}

export interface Todo {
  id: string;
  title: string;
  notes?: string;
  status: 'active' | 'completed' | 'deleted';
  dueAt?: string;
  remindAt?: string;
  remindedAt?: string;
  source: 'manual' | 'chat' | 'agent' | 'imported';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TodoCreateInput {
  title: string;
  notes?: string;
  dueAt?: string;
  remindAt?: string;
}

export interface TodoSnoozeInput {
  id: string;
  minutes: number;
}

export interface ShareGenerateInput {
  dataUrl: string;
  fileName?: string;
}

export interface ShareGenerateResult {
  filePath: string;
}

export type MemoryKind = 'profile' | 'preference' | 'project' | 'fact' | 'note';
export type MemorySource = 'manual' | 'chat' | 'agent' | 'system';

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  content: string;
  source: MemorySource;
  tags: string[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface MemoryCreateInput {
  kind: MemoryKind;
  content: string;
  tags?: string[];
  source?: MemorySource;
  confidence?: number;
}

export interface PetConfig {
  petName: string;
  userName: string;
  alwaysOnTop: boolean;
  doNotDisturb: boolean;
}

export interface NotificationConfig {
  enabled: boolean;
  soundEnabled: boolean;
}

export interface DeepSeekConfig {
  apiKeyConfigured: boolean;
  model: string;
  encryptionAvailable: boolean;
}

export interface DeepSeekUpdateInput {
  apiKey?: string;
  model?: string;
}

export interface DataLocationInfo {
  userDataPath: string;
  shareImagePath: string;
}

export type AppErrorCode =
  | 'DEEPSEEK_NOT_CONFIGURED'
  | 'DEEPSEEK_TIMEOUT'
  | 'DEEPSEEK_RATE_LIMITED'
  | 'DEEPSEEK_REQUEST_FAILED'
  | 'TODO_INVALID_INPUT'
  | 'REMINDER_TIME_INVALID'
  | 'AGENT_INVALID_INPUT'
  | 'AGENT_SOURCE_UNAVAILABLE'
  | 'MEMORY_INVALID_INPUT'
  | 'SHARE_REDACTION_REQUIRED'
  | 'SETTINGS_INVALID_INPUT'
  | 'SETTINGS_ENCRYPTION_UNAVAILABLE'
  | 'IPC_INVALID_PAYLOAD'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_WRITE_FAILED';

export type AppResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: AppErrorCode;
        message: string;
        recoverable: boolean;
      };
    };
