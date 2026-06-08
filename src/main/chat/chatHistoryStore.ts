import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chatHistoryLimit } from '../../shared/defaults';
import type { ChatMessage } from '../../shared/types';

interface DeskPetStore {
  chatMessages: ChatMessage[];
}

export class ChatHistoryStore {
  constructor(private readonly filePath: string) {}

  list(): ChatMessage[] {
    return this.read().chatMessages;
  }

  append(messages: ChatMessage[]): ChatMessage[] {
    const nextMessages = [...this.list(), ...messages].slice(-chatHistoryLimit);
    this.write({ chatMessages: nextMessages });
    return nextMessages;
  }

  clear(): void {
    this.write({ chatMessages: [] });
  }

  private read(): DeskPetStore {
    if (!existsSync(this.filePath)) {
      return { chatMessages: [] };
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DeskPetStore>;

      return {
        chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : []
      };
    } catch (error) {
      console.warn(`ChatHistoryStore: 无法解析 ${this.filePath}，已重置`, error);
      return { chatMessages: [] };
    }
  }

  private write(data: DeskPetStore): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
