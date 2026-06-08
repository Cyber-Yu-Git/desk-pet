import { describe, expect, it } from 'vitest';
import { chatSystemPrompt } from '../src/shared/defaults';
import type { ChatMessage } from '../src/shared/types';
import { buildDeepSeekMessages, requestDeepSeekReply } from '../src/main/chat/deepSeekClient';

function createMessage(index: number, role: ChatMessage['role']): ChatMessage {
  return {
    id: String(index),
    role,
    content: `message-${index}`,
    createdAt: new Date(2026, 0, index + 1).toISOString()
  };
}

describe('deepSeekClient', () => {
  it('builds a bounded DeepSeek message list with a system prompt', () => {
    const history = Array.from({ length: 25 }, (_, index) => createMessage(index, index % 2 === 0 ? 'user' : 'assistant'));
    const messages = buildDeepSeekMessages(history);

    expect(messages).toHaveLength(21);
    expect(messages[0]).toEqual({ role: 'system', content: chatSystemPrompt });
    expect(messages[1]?.content).toBe('message-5');
    expect(messages.at(-1)?.content).toBe('message-24');
  });

  it('adds memories to the system prompt', () => {
    const messages = buildDeepSeekMessages([], [
      {
        id: 'memory-1',
        kind: 'preference',
        content: '喜欢短回答',
        source: 'manual',
        tags: [],
        confidence: 0.9,
        createdAt: new Date(2026, 0, 1).toISOString(),
        updatedAt: new Date(2026, 0, 1).toISOString()
      }
    ]);

    expect(messages[0]?.content).toContain('喜欢短回答');
  });

  it('fails fast when DeepSeek API key is missing', async () => {
    const result = await requestDeepSeekReply([], {
      apiKey: '',
      fetcher: async () => {
        throw new Error('fetch should not be called');
      }
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('DEEPSEEK_NOT_CONFIGURED');
  });
});
