import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Todo, TodoCreateInput } from '../../shared/types';

interface TodoStoreData {
  todos: Todo[];
}

export class TodoStore {
  constructor(private readonly filePath: string) {}

  list(): Todo[] {
    return this.read()
      .todos.filter((todo) => todo.status !== 'deleted')
      .sort((a, b) => getSortTime(a) - getSortTime(b));
  }

  listActiveReminders(): Todo[] {
    return this.list().filter((todo) => todo.status === 'active' && Boolean(todo.remindAt));
  }

  create(input: TodoCreateInput): Todo {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: randomUUID(),
      title: input.title,
      notes: input.notes,
      status: 'active',
      dueAt: input.dueAt,
      remindAt: input.remindAt,
      source: 'manual',
      createdAt: now,
      updatedAt: now
    };

    const data = this.read();
    this.write({ todos: [...data.todos, todo] });
    return todo;
  }

  complete(id: string): Todo | undefined {
    return this.update(id, (todo, now) => ({
      ...todo,
      status: 'completed',
      updatedAt: now,
      completedAt: now
    }));
  }

  delete(id: string): Todo | undefined {
    return this.update(id, (todo, now) => ({
      ...todo,
      status: 'deleted',
      updatedAt: now
    }));
  }

  snooze(id: string, minutes: number): Todo | undefined {
    const remindAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    return this.update(id, (todo, now) => ({
      ...todo,
      status: 'active',
      remindAt,
      remindedAt: undefined,
      updatedAt: now
    }));
  }

  findDueReminders(now = new Date()): Todo[] {
    const time = now.getTime();

    return this.list().filter((todo) => {
      if (todo.status !== 'active' || !todo.remindAt || todo.remindedAt) {
        return false;
      }

      return new Date(todo.remindAt).getTime() <= time;
    });
  }

  markReminded(id: string, remindedAt = new Date().toISOString()): Todo | undefined {
    return this.update(id, (todo, now) => ({
      ...todo,
      remindedAt,
      updatedAt: now
    }));
  }

  private update(id: string, updater: (todo: Todo, now: string) => Todo): Todo | undefined {
    const data = this.read();
    const now = new Date().toISOString();
    let updatedTodo: Todo | undefined;

    const todos = data.todos.map((todo) => {
      if (todo.id !== id) {
        return todo;
      }

      updatedTodo = updater(todo, now);
      return updatedTodo;
    });

    if (!updatedTodo) {
      return undefined;
    }

    this.write({ todos });
    return updatedTodo;
  }

  private read(): TodoStoreData {
    if (!existsSync(this.filePath)) {
      return { todos: [] };
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<TodoStoreData>;

      return {
        todos: Array.isArray(parsed.todos) ? parsed.todos : []
      };
    } catch (error) {
      console.warn(`TodoStore: 无法解析 ${this.filePath}，已重置`, error);
      return { todos: [] };
    }
  }

  private write(data: TodoStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

function getSortTime(todo: Todo): number {
  return new Date(todo.remindAt ?? todo.dueAt ?? todo.createdAt).getTime();
}
