import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MemoryCreateInput, MemoryItem } from '../../shared/types';

interface MemoryStoreData {
  memories: MemoryItem[];
}

export class MemoryStore {
  constructor(private readonly filePath: string) {}

  list(): MemoryItem[] {
    return this.read().memories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  listForPrompt(limit = 8): MemoryItem[] {
    return this.list()
      .filter((memory) => memory.confidence >= 0.4)
      .sort((a, b) => b.confidence - a.confidence || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  create(input: MemoryCreateInput): MemoryItem {
    const now = new Date().toISOString();
    const memory: MemoryItem = {
      id: randomUUID(),
      kind: input.kind,
      content: input.content,
      source: input.source ?? 'manual',
      tags: input.tags ?? [],
      confidence: input.confidence ?? 0.7,
      createdAt: now,
      updatedAt: now
    };

    const data = this.read();
    this.write({ memories: [memory, ...data.memories].slice(0, 200) });
    return memory;
  }

  delete(id: string): MemoryItem[] {
    const memories = this.read().memories.filter((memory) => memory.id !== id);
    this.write({ memories });
    return this.list();
  }

  clear(): void {
    this.write({ memories: [] });
  }

  markUsed(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }

    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const memories = this.read().memories.map((memory) =>
      idSet.has(memory.id)
        ? {
            ...memory,
            lastUsedAt: now,
            updatedAt: now
          }
        : memory
    );

    this.write({ memories });
  }

  private read(): MemoryStoreData {
    if (!existsSync(this.filePath)) {
      return { memories: [] };
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<MemoryStoreData>;

      return {
        memories: Array.isArray(parsed.memories) ? parsed.memories : []
      };
    } catch (error) {
      console.warn(`MemoryStore: 无法解析 ${this.filePath}，已重置`, error);
      return { memories: [] };
    }
  }

  private write(data: MemoryStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
