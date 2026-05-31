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

export type AgentKind = 'claude-code' | 'codex' | 'trae' | 'openclaw' | 'terminal';

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
  source: 'manual' | 'chat' | 'agent' | 'imported';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
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

export type AppErrorCode =
  | 'DEEPSEEK_NOT_CONFIGURED'
  | 'DEEPSEEK_TIMEOUT'
  | 'DEEPSEEK_RATE_LIMITED'
  | 'DEEPSEEK_REQUEST_FAILED'
  | 'TODO_INVALID_INPUT'
  | 'REMINDER_TIME_INVALID'
  | 'AGENT_SOURCE_UNAVAILABLE'
  | 'SHARE_REDACTION_REQUIRED'
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
