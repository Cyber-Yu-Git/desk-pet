import { describe, expect, it } from 'vitest';
import { validateMemoryCreateInput, validateMemoryId } from '../src/main/memory/validateMemoryInput';

describe('validateMemoryInput', () => {
  it('accepts valid memory input and normalizes tags', () => {
    const result = validateMemoryCreateInput({
      kind: 'preference',
      content: '  喜欢简洁回答  ',
      tags: ['AI', ' AI ', '工作流'],
      confidence: 2
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.content : '').toBe('喜欢简洁回答');
    expect(result.ok ? result.data.tags : []).toEqual(['AI', '工作流']);
    expect(result.ok ? result.data.confidence : 0).toBe(1);
  });

  it('rejects invalid memory kinds', () => {
    const result = validateMemoryCreateInput({ kind: 'unknown', content: '记住我' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('MEMORY_INVALID_INPUT');
  });

  it('rejects invalid memory ids', () => {
    const result = validateMemoryId({ id: '' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('MEMORY_INVALID_INPUT');
  });
});
