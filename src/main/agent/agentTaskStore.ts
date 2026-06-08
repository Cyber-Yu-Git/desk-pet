import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  AgentIntegrationScope,
  AgentKind,
  AgentStatus,
  AgentTask,
  AgentTaskCreateInput,
  AgentTaskUpdateStatusInput
} from '../../shared/types';

interface AgentTaskStoreData {
  tasks: AgentTask[];
}

export interface AgentWatcherTaskInput {
  integrationId: string;
  agent: AgentKind;
  scope: AgentIntegrationScope;
  sessionId: string;
  title: string;
  status: AgentStatus;
  message?: string;
  projectPath?: string;
}

export class AgentTaskStore {
  constructor(private readonly filePath: string) {}

  list(): AgentTask[] {
    return this.read().tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  create(input: AgentTaskCreateInput): AgentTask {
    const now = new Date().toISOString();
    const task: AgentTask = {
      id: randomUUID(),
      title: input.title,
      agent: input.agent,
      projectPath: input.projectPath,
      status: 'started',
      source: 'simulator',
      createdAt: now,
      updatedAt: now
    };

    const data = this.read();
    this.write({ tasks: [task, ...data.tasks].slice(0, 100) });
    return task;
  }

  updateStatus(input: AgentTaskUpdateStatusInput): AgentTask | undefined {
    const data = this.read();
    const now = new Date().toISOString();
    let updatedTask: AgentTask | undefined;

    const tasks = data.tasks.map((task) => {
      if (task.id !== input.id) {
        return task;
      }

      updatedTask = {
        ...task,
        status: input.status,
        message: input.message,
        updatedAt: now,
        completedAt: input.status === 'completed' || input.status === 'failed' ? now : undefined
      };

      return updatedTask;
    });

    if (!updatedTask) {
      return undefined;
    }

    this.write({ tasks });
    return updatedTask;
  }

  upsertWatcherTask(input: AgentWatcherTaskInput): AgentTask {
    const data = this.read();
    const now = new Date().toISOString();
    const id = `watcher:${input.integrationId}:${input.sessionId}`;
    const completedAt = input.status === 'completed' || input.status === 'failed' ? now : undefined;
    const existingTask = data.tasks.find((task) => task.id === id);
    const task: AgentTask = existingTask
      ? {
          ...existingTask,
          integrationId: input.integrationId,
          title: input.title,
          scope: input.scope,
          sessionId: input.sessionId,
          status: input.status,
          message: input.message,
          projectPath: input.projectPath ?? existingTask.projectPath,
          updatedAt: now,
          completedAt
        }
      : {
          id,
          integrationId: input.integrationId,
          title: input.title,
          agent: input.agent,
          scope: input.scope,
          sessionId: input.sessionId,
          status: input.status,
          message: input.message,
          projectPath: input.projectPath,
          source: 'watcher',
          createdAt: now,
          updatedAt: now,
          completedAt
        };

    const tasks = [task, ...data.tasks.filter((storedTask) => storedTask.id !== id)].slice(0, 100);
    this.write({ tasks });
    return task;
  }

  delete(id: string): AgentTask[] {
    const tasks = this.read().tasks.filter((task) => task.id !== id);
    this.write({ tasks });
    return this.list();
  }

  private read(): AgentTaskStoreData {
    if (!existsSync(this.filePath)) {
      return { tasks: [] };
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AgentTaskStoreData>;

      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
      };
    } catch (error) {
      console.warn(`AgentTaskStore: 无法解析 ${this.filePath}，已重置`, error);
      return { tasks: [] };
    }
  }

  private write(data: AgentTaskStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
