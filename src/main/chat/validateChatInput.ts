import type { AppResult, ChatSendInput } from '../../shared/types';

const maxChatInputLength = 4000;

export function validateChatInput(input: unknown): AppResult<ChatSendInput> {
  if (!isRecord(input) || typeof input.content !== 'string') {
    return invalidInput('请输入要发送的消息。');
  }

  const content = input.content.trim();

  if (content.length === 0) {
    return invalidInput('消息不能为空。');
  }

  if (content.length > maxChatInputLength) {
    return invalidInput(`消息不能超过 ${maxChatInputLength} 个字符。`);
  }

  return {
    ok: true,
    data: { content }
  };
}

function invalidInput(message: string): AppResult<ChatSendInput> {
  return {
    ok: false,
    error: {
      code: 'IPC_INVALID_PAYLOAD',
      message,
      recoverable: true
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
