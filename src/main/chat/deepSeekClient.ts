import { chatSystemPrompt } from '../../shared/defaults';
import type { AppResult, ChatMessage } from '../../shared/types';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface DeepSeekClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export function buildDeepSeekMessages(history: ChatMessage[]): DeepSeekMessage[] {
  const recentMessages = history
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  return [
    {
      role: 'system',
      content: chatSystemPrompt
    },
    ...recentMessages
  ];
}

export async function requestDeepSeekReply(
  history: ChatMessage[],
  options: DeepSeekClientOptions = {}
): Promise<AppResult<string>> {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: 'DEEPSEEK_NOT_CONFIGURED',
        message: '还没有配置 DeepSeek API Key。请在启动前设置 DEEPSEEK_API_KEY。',
        recoverable: true
      }
    };
  }

  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

  try {
    const response = await fetcher(options.baseUrl ?? 'https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
        messages: buildDeepSeekMessages(history),
        temperature: 0.7
      }),
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: response.status === 429 ? 'DEEPSEEK_RATE_LIMITED' : 'DEEPSEEK_REQUEST_FAILED',
          message: payload.error?.message ?? `DeepSeek 请求失败：${response.status}`,
          recoverable: true
        }
      };
    }

    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return {
        ok: false,
        error: {
          code: 'DEEPSEEK_REQUEST_FAILED',
          message: 'DeepSeek 没有返回有效内容。',
          recoverable: true
        }
      };
    }

    return { ok: true, data: content };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'DEEPSEEK_TIMEOUT',
        message: error instanceof Error ? error.message : 'DeepSeek 请求超时。',
        recoverable: true
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}
