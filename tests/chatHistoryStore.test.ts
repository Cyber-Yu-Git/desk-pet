import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChatHistoryStore } from '../src/main/chat/chatHistoryStore';
import type { ChatMessage } from '../src/shared/types';

function createMessage(content: string, role: ChatMessage['role'] = 'user'): ChatMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

describe('ChatHistoryStore', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-test-')));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty list for a fresh store', () => {
    const filePath = join(dir, 'fresh-chat.json');
    const store = new ChatHistoryStore(filePath);
    expect(store.list()).toEqual([]);
  });

  it('appends and returns persisted messages', () => {
    const filePath = join(dir, 'persisted-chat.json');
    const store = new ChatHistoryStore(filePath);
    const m1 = createMessage('你好');
    const m2 = createMessage('好久不见');

    const result1 = store.append([m1]);
    expect(result1).toHaveLength(1);
    expect(result1[0]?.content).toBe('你好');

    const result2 = store.append([m2]);
    expect(result2).toHaveLength(2);
    expect(result2[1]?.content).toBe('好久不见');
  });

  it('trims messages to the limit', () => {
    const filePath = join(dir, 'limited-chat.json');
    const store = new ChatHistoryStore(filePath);
    const bulk = Array.from({ length: 250 }, (_, i) => createMessage(`msg-${i}`));
    const result = store.append(bulk);

    expect(result.length).toBeLessThanOrEqual(200);
    expect(result[0]?.content).toBe('msg-50');
  });

  it('recovers from a corrupted file', () => {
    const filePath = join(dir, 'corrupted-chat.json');
    writeFileSync(filePath, 'not-json{{{');

    const store = new ChatHistoryStore(filePath);
    expect(store.list()).toEqual([]);

    // Should still be writable after recovery
    const msg = createMessage('after recovery');
    const result = store.append([msg]);
    expect(result).toHaveLength(1);
  });
});
