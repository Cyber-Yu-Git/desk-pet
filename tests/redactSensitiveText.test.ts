import { describe, expect, it } from 'vitest';
import { redactSensitiveText } from '../src/main/security/redactSensitiveText';

describe('redactSensitiveText', () => {
  it('redacts common sensitive values', () => {
    const input = [
      'key=sk-1234567890abcdef',
      'email=test@example.com',
      'phone=13800138000',
      'auth=Bearer abc.def-ghi',
      'path=C:\\Users\\demo\\project\\secret.txt'
    ].join('\n');

    const output = redactSensitiveText(input);

    expect(output).not.toContain('sk-1234567890abcdef');
    expect(output).not.toContain('test@example.com');
    expect(output).not.toContain('13800138000');
    expect(output).not.toContain('abc.def-ghi');
    expect(output).not.toContain('C:\\Users\\demo');
    expect(output).toContain('[REDACTED_API_KEY]');
    expect(output).toContain('[REDACTED_EMAIL]');
    expect(output).toContain('[REDACTED_PHONE]');
    expect(output).toContain('[REDACTED_PATH]');
  });
});
