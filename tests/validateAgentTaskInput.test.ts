import { describe, expect, it } from 'vitest';
import {
  validateAgentTaskCreateInput,
  validateAgentTaskId,
  validateAgentTaskUpdateStatusInput
} from '../src/main/agent/validateAgentTaskInput';

describe('validateAgentTaskInput', () => {
  it('accepts valid agent task create input', () => {
    const result = validateAgentTaskCreateInput({ title: '  跑完构建  ', agent: 'trae' });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.title : '').toBe('跑完构建');
    expect(result.ok ? result.data.agent : '').toBe('trae');
  });

  it('rejects unsupported agent kinds', () => {
    const result = validateAgentTaskCreateInput({ title: '跑完构建', agent: 'unknown' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('AGENT_INVALID_INPUT');
  });

  it('accepts valid status update input', () => {
    const result = validateAgentTaskUpdateStatusInput({ id: 'task-1', status: 'completed', message: 'ok' });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.status : '').toBe('completed');
  });

  it('rejects invalid task ids', () => {
    const result = validateAgentTaskId({ id: '' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('AGENT_INVALID_INPUT');
  });
});
