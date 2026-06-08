import { describe, expect, it } from 'vitest';
import { normalizeClaudeHookEvent } from '../src/main/agent/claudeHookNormalizer';

describe('normalizeClaudeHookEvent', () => {
  it('maps Claude Code stop events to completed watcher tasks', () => {
    const event = normalizeClaudeHookEvent({
      hook_event_name: 'Stop',
      session_id: 'session-1',
      cwd: 'C:\\projects\\desk-pet'
    });

    expect(event.sessionId).toBe('session-1');
    expect(event.status).toBe('completed');
    expect(event.title).toBe('Claude Code: desk-pet');
    expect(event.priority).toBe('high');
  });

  it('maps permission notifications to waiting status', () => {
    const event = normalizeClaudeHookEvent({
      hook_event_name: 'Notification',
      session_id: 'session-2',
      message: 'Claude needs permission to run a tool'
    });

    expect(event.status).toBe('waiting_permission');
    expect(event.message).toContain('permission');
  });

  it('uses prompt text as the session title', () => {
    const event = normalizeClaudeHookEvent({
      hook_event_name: 'UserPromptSubmit',
      session_id: 'session-3',
      prompt: '实现 Claude Code Hook 监听'
    });

    expect(event.status).toBe('started');
    expect(event.title).toBe('实现 Claude Code Hook 监听');
  });
});
