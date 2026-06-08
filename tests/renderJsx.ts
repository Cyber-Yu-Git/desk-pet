/**
 * 轻量 JSX 元素 → HTML 字符串提取器
 * 递归展开 React 元素树，拼接为可断言的字符串。
 */
import React from 'react';

export function renderJSX(element: React.ReactElement): string {
  return extract(element);
}

function extract(node: unknown): string {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extract).join('');

  if (!React.isValidElement(node)) return '';

  const props = node.props as Record<string, unknown>;
  const children = props.children;
  const text = extract(children);

  // 提取关键文本内容用于断言
  return text;
}
