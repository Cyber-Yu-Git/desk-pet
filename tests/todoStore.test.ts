import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TodoStore } from '../src/main/todo/todoStore';

describe('TodoStore', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-todo-test-')));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates and lists active todos', () => {
    const store = new TodoStore(join(dir, 'create.json'));
    const todo = store.create({ title: '喝水' });

    expect(todo.status).toBe('active');
    expect(store.list()[0]?.title).toBe('喝水');
  });

  it('completes and deletes todos', () => {
    const store = new TodoStore(join(dir, 'complete.json'));
    const todo = store.create({ title: '站起来走走' });

    expect(store.complete(todo.id)?.status).toBe('completed');
    expect(store.delete(todo.id)?.status).toBe('deleted');
    expect(store.list()).toEqual([]);
  });

  it('finds due reminders only once after marking reminded', () => {
    const store = new TodoStore(join(dir, 'reminder.json'));
    const todo = store.create({
      title: '看提醒',
      remindAt: new Date(Date.now() - 1000).toISOString()
    });

    expect(store.findDueReminders()).toHaveLength(1);
    store.markReminded(todo.id);
    expect(store.findDueReminders()).toHaveLength(0);
  });
});
