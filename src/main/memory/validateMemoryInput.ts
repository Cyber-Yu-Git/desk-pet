import type { AppResult, MemoryCreateInput, MemoryKind, MemorySource } from '../../shared/types';

const memoryKinds = new Set<MemoryKind>(['profile', 'preference', 'project', 'fact', 'note']);
const memorySources = new Set<MemorySource>(['manual', 'chat', 'agent', 'system']);
const maxMemoryContentLength = 500;
const maxTagLength = 24;
const maxTags = 8;

export function validateMemoryCreateInput(input: unknown): AppResult<MemoryCreateInput> {
  if (!isRecord(input) || typeof input.content !== 'string') {
    return invalidMemory('请输入要记住的内容。');
  }

  const content = input.content.trim();

  if (!content) {
    return invalidMemory('记忆内容不能为空。');
  }

  if (content.length > maxMemoryContentLength) {
    return invalidMemory(`记忆内容不能超过 ${maxMemoryContentLength} 个字符。`);
  }

  if (typeof input.kind !== 'string' || !memoryKinds.has(input.kind as MemoryKind)) {
    return invalidMemory('记忆类型无效。');
  }

  const source =
    typeof input.source === 'string' && memorySources.has(input.source as MemorySource)
      ? (input.source as MemorySource)
      : 'manual';

  const tags = normalizeTags(input.tags);
  const confidence = normalizeConfidence(input.confidence);

  return {
    ok: true,
    data: {
      kind: input.kind as MemoryKind,
      content,
      source,
      tags,
      confidence
    }
  };
}

export function validateMemoryId(input: unknown): AppResult<string> {
  if (!isRecord(input) || typeof input.id !== 'string' || !input.id.trim()) {
    return invalidMemory('记忆 ID 无效。');
  }

  return { ok: true, data: input.id.trim() };
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= maxTagLength)
    )
  ).slice(0, maxTags);
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0.7;
  }

  return Math.min(1, Math.max(0, value));
}

function invalidMemory(message: string): AppResult<never> {
  return {
    ok: false,
    error: {
      code: 'MEMORY_INVALID_INPUT',
      message,
      recoverable: true
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
