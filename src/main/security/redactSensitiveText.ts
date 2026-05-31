const patterns: Array<[RegExp, string]> = [
  [/(sk-[a-zA-Z0-9_-]{12,})/g, '[REDACTED_API_KEY]'],
  [/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '[REDACTED_EMAIL]'],
  [/(\b1[3-9]\d{9}\b)/g, '[REDACTED_PHONE]'],
  [/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED_TOKEN]'],
  [/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)+[^\\/:*?"<>|\r\n]*/g, '[REDACTED_PATH]']
];

export function redactSensitiveText(input: string): string {
  return patterns.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), input);
}
