import { describe, expect, it } from 'vitest';
import { getPngBufferFromDataUrl, validateShareGenerateInput } from '../src/main/share/validateShareInput';

const onePixelPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l9u9pQAAAABJRU5ErkJggg==';

describe('validateShareGenerateInput', () => {
  it('accepts PNG data urls and sanitizes file names', () => {
    const result = validateShareGenerateInput({
      dataUrl: onePixelPng,
      fileName: '赛博宇:分享图?.png'
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.fileName : '').toBe('赛博宇-分享图-.png');
    expect(getPngBufferFromDataUrl(onePixelPng).length).toBeGreaterThan(0);
  });

  it('rejects non-PNG data urls', () => {
    const result = validateShareGenerateInput({ dataUrl: 'data:image/jpeg;base64,abc' });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.code).toBe('SHARE_REDACTION_REQUIRED');
  });
});
