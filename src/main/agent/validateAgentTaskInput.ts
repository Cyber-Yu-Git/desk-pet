import type { AgentKind, AgentStatus, AgentTaskCreateInput, AgentTaskUpdateStatusInput, AppResult } from '../../shared/types';

const agentKinds = new Set<AgentKind>(['claude-code', 'codex', 'trae', 'openclaw', 'terminal']);
const agentStatuses = new Set<AgentStatus>([
  'started',
  'running',
  'waiting_permission',
  'completed',
  'failed',
  'idle_too_long'
]);
const maxTitleLength = 140;
const maxMessageLength = 500;

export function validateAgentTaskCreateInput(input: unknown): AppResult<AgentTaskCreateInput> {
  if (!isRecord(input) || typeof input.title !== 'string') {
    return invalidAgent('请输入要盯的任务。');
  }

  const title = input.title.trim();

  if (!title) {
    return invalidAgent('任务标题不能为空。');
  }

  if (title.length > maxTitleLength) {
    return invalidAgent(`任务标题不能超过 ${maxTitleLength} 个字符。`);
  }

  if (typeof input.agent !== 'string' || !agentKinds.has(input.agent as AgentKind)) {
    return invalidAgent('Agent 类型无效。');
  }

  const projectPath = typeof input.projectPath === 'string' ? input.projectPath.trim() : undefined;

  return {
    ok: true,
    data: {
      title,
      agent: input.agent as AgentKind,
      projectPath: projectPath || undefined
    }
  };
}

export function validateAgentTaskUpdateStatusInput(input: unknown): AppResult<AgentTaskUpdateStatusInput> {
  if (!isRecord(input) || typeof input.id !== 'string' || !input.id.trim()) {
    return invalidAgent('Agent 任务 ID 无效。');
  }

  if (typeof input.status !== 'string' || !agentStatuses.has(input.status as AgentStatus)) {
    return invalidAgent('Agent 状态无效。');
  }

  const message = typeof input.message === 'string' ? input.message.trim() : undefined;

  if (message && message.length > maxMessageLength) {
    return invalidAgent(`状态备注不能超过 ${maxMessageLength} 个字符。`);
  }

  return {
    ok: true,
    data: {
      id: input.id.trim(),
      status: input.status as AgentStatus,
      message: message || undefined
    }
  };
}

export function validateAgentTaskId(input: unknown): AppResult<string> {
  if (!isRecord(input) || typeof input.id !== 'string' || !input.id.trim()) {
    return invalidAgent('Agent 任务 ID 无效。');
  }

  return { ok: true, data: input.id.trim() };
}

function invalidAgent(message: string): AppResult<never> {
  return {
    ok: false,
    error: {
      code: 'AGENT_INVALID_INPUT',
      message,
      recoverable: true
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
