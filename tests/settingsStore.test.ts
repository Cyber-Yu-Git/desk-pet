import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SettingsStore, type SettingsCrypto } from '../src/main/settings/settingsStore';

function createCrypto(available = true): SettingsCrypto {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^encrypted:/, '')
  };
}

describe('SettingsStore', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'desk-pet-settings-test-')));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves encrypted DeepSeek API key and model', () => {
    const store = new SettingsStore(join(dir, 'save.json'), createCrypto());
    const result = store.updateDeepSeekConfig({ apiKey: 'sk-test', model: 'deepseek-reasoner' });

    expect(result.ok).toBe(true);
    expect(store.getDeepSeekConfig().apiKeyConfigured).toBe(true);
    expect(store.getDeepSeekApiKey()).toBe('sk-test');
    expect(store.getDeepSeekModel()).toBe('deepseek-reasoner');
  });

  it('clears DeepSeek API key when given an empty key', () => {
    const store = new SettingsStore(join(dir, 'clear.json'), createCrypto());
    store.updateDeepSeekConfig({ apiKey: 'sk-test' });
    const result = store.updateDeepSeekConfig({ apiKey: '' });

    expect(result.ok).toBe(true);
    expect(store.getDeepSeekConfig().apiKeyConfigured).toBe(false);
    expect(store.getDeepSeekApiKey()).toBeUndefined();
  });

  it('rejects saving API key when encryption is unavailable', () => {
    const store = new SettingsStore(join(dir, 'no-encryption.json'), createCrypto(false));
    const result = store.updateDeepSeekConfig({ apiKey: 'sk-test' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('SETTINGS_ENCRYPTION_UNAVAILABLE');
  });

  it('rejects invalid model names', () => {
    const store = new SettingsStore(join(dir, 'invalid-model.json'), createCrypto());
    const result = store.updateDeepSeekConfig({ model: 'bad model name' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('SETTINGS_INVALID_INPUT');
  });
});
