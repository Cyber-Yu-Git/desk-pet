import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryStore } from '../src/main/memory/memoryStore';

describe('MemoryStore', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-memory-test-')));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates and lists memories', () => {
    const store = new MemoryStore(join(dir, 'create.json'));
    const memory = store.create({
      kind: 'preference',
      content: '喜欢短回答',
      source: 'manual',
      tags: ['chat'],
      confidence: 0.8
    });

    expect(memory.kind).toBe('preference');
    expect(store.list()[0]?.content).toBe('喜欢短回答');
  });

  it('returns high-confidence memories for prompts', () => {
    const store = new MemoryStore(join(dir, 'prompt.json'));
    store.create({ kind: 'note', content: '低置信', source: 'manual', tags: [], confidence: 0.1 });
    store.create({ kind: 'fact', content: '高置信', source: 'manual', tags: [], confidence: 0.9 });

    expect(store.listForPrompt()).toHaveLength(1);
    expect(store.listForPrompt()[0]?.content).toBe('高置信');
  });

  it('marks memories as used and deletes them', () => {
    const store = new MemoryStore(join(dir, 'use-delete.json'));
    const memory = store.create({ kind: 'fact', content: '常用项目', source: 'manual', tags: [], confidence: 0.9 });

    store.markUsed([memory.id]);
    expect(store.list()[0]?.lastUsedAt).toBeTruthy();
    expect(store.delete(memory.id)).toEqual([]);
  });
});
