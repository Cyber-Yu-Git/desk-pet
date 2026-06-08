import type { AppResult, ShareGenerateInput } from '../../shared/types';

const pngPrefix = 'data:image/png;base64,';
const maxImageBytes = 8 * 1024 * 1024;

export function validateShareGenerateInput(input: unknown): AppResult<ShareGenerateInput> {
  if (!isRecord(input) || typeof input.dataUrl !== 'string') {
    return invalidShare('分享图数据无效。');
  }

  if (!input.dataUrl.startsWith(pngPrefix)) {
    return invalidShare('分享图必须是 PNG 图片。');
  }

  const base64 = input.dataUrl.slice(pngPrefix.length);
  const byteLength = Math.floor((base64.length * 3) / 4);

  if (byteLength <= 0 || byteLength > maxImageBytes) {
    return invalidShare('分享图大小无效。');
  }

  const fileName = typeof input.fileName === 'string' ? sanitizeFileName(input.fileName) : undefined;

  return {
    ok: true,
    data: {
      dataUrl: input.dataUrl,
      fileName
    }
  };
}

export function getPngBufferFromDataUrl(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(pngPrefix.length), 'base64');
}

function sanitizeFileName(fileName: string): string | undefined {
  const cleaned = fileName
    .trim()
    .split('')
    .map((char) => (isSafeFileNameChar(char) ? char : '-'))
    .join('')
    .replace(/\s+/g, '-')
    .slice(0, 80);

  return cleaned || undefined;
}

function isSafeFileNameChar(char: string): boolean {
  return !'<>:"/\\|?*'.includes(char) && char.charCodeAt(0) >= 32;
}

function invalidShare(message: string): AppResult<never> {
  return {
    ok: false,
    error: {
      code: 'SHARE_REDACTION_REQUIRED',
      message,
      recoverable: true
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
