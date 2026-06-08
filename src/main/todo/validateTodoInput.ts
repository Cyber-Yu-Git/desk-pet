import type { AppResult, TodoCreateInput, TodoSnoozeInput } from '../../shared/types';

const maxTodoTitleLength = 120;
const maxTodoNotesLength = 1000;

export function validateTodoCreateInput(input: unknown): AppResult<TodoCreateInput> {
  if (!isRecord(input) || typeof input.title !== 'string') {
    return invalidTodo('请输入待办标题。');
  }

  const title = input.title.trim();

  if (!title) {
    return invalidTodo('待办标题不能为空。');
  }

  if (title.length > maxTodoTitleLength) {
    return invalidTodo(`待办标题不能超过 ${maxTodoTitleLength} 个字符。`);
  }

  const notes = typeof input.notes === 'string' ? input.notes.trim() : undefined;

  if (notes && notes.length > maxTodoNotesLength) {
    return invalidTodo(`备注不能超过 ${maxTodoNotesLength} 个字符。`);
  }

  const dueAt = validateOptionalDate(input.dueAt, '截止时间无效。');
  if (!dueAt.ok) {
    return dueAt;
  }

  const remindAt = validateOptionalDate(input.remindAt, '提醒时间无效。');
  if (!remindAt.ok) {
    return remindAt;
  }

  return {
    ok: true,
    data: {
      title,
      notes,
      dueAt: dueAt.data,
      remindAt: remindAt.data
    }
  };
}

export function validateTodoId(input: unknown): AppResult<string> {
  if (!isRecord(input) || typeof input.id !== 'string' || !input.id.trim()) {
    return invalidTodo('待办 ID 无效。');
  }

  return { ok: true, data: input.id.trim() };
}

export function validateTodoSnoozeInput(input: unknown): AppResult<TodoSnoozeInput> {
  if (!isRecord(input) || typeof input.id !== 'string' || !input.id.trim() || typeof input.minutes !== 'number') {
    return invalidTodo('稍后提醒参数无效。');
  }

  if (!Number.isFinite(input.minutes) || input.minutes < 1 || input.minutes > 1440) {
    return invalidTodo('稍后提醒时间必须在 1 到 1440 分钟之间。');
  }

  return {
    ok: true,
    data: {
      id: input.id.trim(),
      minutes: Math.round(input.minutes)
    }
  };
}

function validateOptionalDate(value: unknown, message: string): AppResult<string | undefined> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, data: undefined };
  }

  if (typeof value !== 'string') {
    return invalidReminder(message);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return invalidReminder(message);
  }

  return { ok: true, data: date.toISOString() };
}

function invalidTodo(message: string): AppResult<never> {
  return {
    ok: false,
    error: {
      code: 'TODO_INVALID_INPUT',
      message,
      recoverable: true
    }
  };
}

function invalidReminder(message: string): AppResult<never> {
  return {
    ok: false,
    error: {
      code: 'REMINDER_TIME_INVALID',
      message,
      recoverable: true
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
