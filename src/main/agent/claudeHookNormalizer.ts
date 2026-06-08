import { createHash } from 'node:crypto';
import type { AgentStatus } from '../../shared/types';

export interface NormalizedClaudeHookEvent {
  sessionId: string;
  title: string;
  status: AgentStatus;
  message?: string;
  projectPath?: string;
  priority: 'low' | 'normal' | 'high';
}

interface ClaudeHookPayload {
  hook_event_name?: unknown;
  session_id?: unknown;
  cwd?: unknown;
  tool_name?: unknown;
  message?: unknown;
  prompt?: unknown;
  transcript_path?: unknown;
  stop_hook_active?: unknown;
}

export function normalizeClaudeHookEvent(payload: unknown): NormalizedClaudeHookEvent {
  const data = isRecord(payload) ? (payload as ClaudeHookPayload) : {};
  const eventName = stringValue(data.hook_event_name) ?? 'Unknown';
  const projectPath = stringValue(data.cwd);
  const sessionId = stringValue(data.session_id) ?? createFallbackSessionId(data);
  const toolName = stringValue(data.tool_name);
  const prompt = stringValue(data.prompt);
  const message = buildMessage(eventName, toolName, stringValue(data.message));
  const status = mapClaudeEventToStatus(eventName, stringValue(data.message));

  return {
    sessionId,
    title: buildTitle(eventName, prompt, projectPath),
    status,
    message,
    projectPath,
    priority: status === 'waiting_permission' || status === 'completed' || status === 'failed' ? 'high' : 'normal'
  };
}

function mapClaudeEventToStatus(eventName: string, message?: string): AgentStatus {
  const normalizedMessage = message?.toLowerCase() ?? '';

  if (eventName === 'Stop' || eventName === 'SubagentStop') {
    return 'completed';
  }

  if (eventName === 'StopFailure') {
    return 'failed';
  }

  if (eventName === 'Notification') {
    return normalizedMessage.includes('permission') || normalizedMessage.includes('confirm') ? 'waiting_permission' : 'running';
  }

  if (eventName === 'SessionStart' || eventName === 'UserPromptSubmit') {
    return 'started';
  }

  return 'running';
}

function buildTitle(eventName: string, prompt?: string, projectPath?: string): string {
  if (prompt) {
    return truncate(prompt, 80);
  }

  const projectName = projectPath?.split(/[\\/]/).filter(Boolean).at(-1);
  return projectName ? `Claude Code: ${projectName}` : `Claude Code: ${eventName}`;
}

function buildMessage(eventName: string, toolName?: string, message?: string): string {
  if (message) {
    return truncate(message, 180);
  }

  return toolName ? `${eventName} ${toolName}` : eventName;
}

function createFallbackSessionId(data: ClaudeHookPayload): string {
  const stableText = [stringValue(data.transcript_path), stringValue(data.cwd), stringValue(data.hook_event_name)]
    .filter(Boolean)
    .join('|');
  return createHash('sha256').update(stableText || Date.now().toString()).digest('hex').slice(0, 16);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
