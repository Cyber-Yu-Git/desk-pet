import { describe, expect, it } from 'vitest';
import { validateChatInput } from '../src/main/chat/validateChatInput';

describe('validateChatInput', () => {
  it('trims valid chat input', () => {
    const result = validateChatInput({ content: '  你好  ' });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.content : '').toBe('你好');
  });

  it('rejects empty chat input', () => {
    const result = validateChatInput({ content: '   ' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('IPC_INVALID_PAYLOAD');
  });
});
