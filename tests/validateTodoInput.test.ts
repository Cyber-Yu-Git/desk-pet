import { describe, expect, it } from 'vitest';
import { validateTodoCreateInput, validateTodoSnoozeInput } from '../src/main/todo/validateTodoInput';

describe('validateTodoInput', () => {
  it('accepts valid todo create input', () => {
    const remindAt = new Date(2026, 0, 1).toISOString();
    const result = validateTodoCreateInput({ title: '  喝水  ', remindAt });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.title : '').toBe('喝水');
    expect(result.ok ? result.data.remindAt : '').toBe(remindAt);
  });

  it('rejects invalid reminder time', () => {
    const result = validateTodoCreateInput({ title: '喝水', remindAt: 'not-date' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('REMINDER_TIME_INVALID');
  });

  it('rejects invalid snooze minutes', () => {
    const result = validateTodoSnoozeInput({ id: 'todo-1', minutes: 0 });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('TODO_INVALID_INPUT');
  });
});
