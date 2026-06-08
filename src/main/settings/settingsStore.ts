import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AppResult, DeepSeekConfig, DeepSeekUpdateInput } from '../../shared/types';

export interface SettingsCrypto {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface SettingsStoreData {
  deepSeek: {
    encryptedApiKey?: string;
    model: string;
  };
}

const defaultModel = 'deepseek-chat';

export class SettingsStore {
  constructor(
    private readonly filePath: string,
    private readonly crypto: SettingsCrypto
  ) {}

  getDeepSeekConfig(): DeepSeekConfig {
    const data = this.read();

    return {
      apiKeyConfigured: Boolean(data.deepSeek.encryptedApiKey),
      model: data.deepSeek.model,
      encryptionAvailable: this.crypto.isEncryptionAvailable()
    };
  }

  getDeepSeekApiKey(): string | undefined {
    const encryptedApiKey = this.read().deepSeek.encryptedApiKey;

    if (!encryptedApiKey || !this.crypto.isEncryptionAvailable()) {
      return undefined;
    }

    try {
      return this.crypto.decryptString(Buffer.from(encryptedApiKey, 'base64'));
    } catch {
      return undefined;
    }
  }

  getDeepSeekModel(): string {
    return this.read().deepSeek.model;
  }

  updateDeepSeekConfig(input: DeepSeekUpdateInput): AppResult<DeepSeekConfig> {
    const normalized = normalizeDeepSeekUpdate(input);

    if (!normalized.ok) {
      return normalized;
    }

    const data = this.read();
    const nextData: SettingsStoreData = {
      deepSeek: {
        ...data.deepSeek,
        model: normalized.data.model ?? data.deepSeek.model
      }
    };

    if (normalized.data.apiKey !== undefined) {
      if (!normalized.data.apiKey) {
        nextData.deepSeek.encryptedApiKey = undefined;
      } else if (!this.crypto.isEncryptionAvailable()) {
        return {
          ok: false,
          error: {
            code: 'SETTINGS_ENCRYPTION_UNAVAILABLE',
            message: '当前系统不可用本机加密，暂不保存 DeepSeek API Key。',
            recoverable: true
          }
        };
      } else {
        nextData.deepSeek.encryptedApiKey = this.crypto.encryptString(normalized.data.apiKey).toString('base64');
      }
    }

    this.write(nextData);
    return {
      ok: true,
      data: this.getDeepSeekConfig()
    };
  }

  private read(): SettingsStoreData {
    if (!existsSync(this.filePath)) {
      return createDefaultSettings();
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SettingsStoreData>;

      return {
        deepSeek: {
          encryptedApiKey: parsed.deepSeek?.encryptedApiKey,
          model: parsed.deepSeek?.model || defaultModel
        }
      };
    } catch (error) {
      console.warn(`SettingsStore: 无法解析 ${this.filePath}，已重置`, error);
      return createDefaultSettings();
    }
  }

  private write(data: SettingsStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

function normalizeDeepSeekUpdate(input: unknown): AppResult<DeepSeekUpdateInput> {
  if (typeof input !== 'object' || input === null) {
    return invalidSettings('设置参数无效。');
  }

  const record = input as Record<string, unknown>;
  const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : undefined;
  const model = typeof record.model === 'string' ? record.model.trim() : undefined;

  if (model !== undefined && !/^[a-zA-Z0-9._-]{2,64}$/.test(model)) {
    return invalidSettings('DeepSeek 模型名无效。');
  }

  return {
    ok: true,
    data: {
      apiKey,
      model
    }
  };
}

function invalidSettings(message: string): AppResult<DeepSeekUpdateInput> {
  return {
    ok: false,
    error: {
      code: 'SETTINGS_INVALID_INPUT',
      message,
      recoverable: true
    }
  };
}

function createDefaultSettings(): SettingsStoreData {
  return {
    deepSeek: {
      model: defaultModel
    }
  };
}
