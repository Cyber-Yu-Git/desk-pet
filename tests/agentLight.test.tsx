/**
 * Agent 状态指示灯 BDD 测试
 */
import { describe, expect, it } from 'vitest';
import { renderJSX } from './renderJsx';
import { AgentLight, type AgentLightItem } from '../src/renderer/src/agent/AgentLight';

describe('AgentLight', () => {
  const items: AgentLightItem[] = [
    { kind: 'claude-code', name: 'Claude Code', status: 'running', title: '重构模块', runningSince: new Date(Date.now() - 120000).toISOString() },
    { kind: 'openclaw', name: 'OpenClaw', status: 'completed', title: '数据分析' },
    { kind: 'opencode', name: 'OpenCode', status: 'waiting_permission', title: '确认部署' },
    { kind: 'hermes', name: 'Hermes', status: 'idle' }
  ];

  it('渲染所有 Agent 行，每行包含圆点+名称+状态', () => {
    const html = renderJSX(<AgentLight items={items} collapsed={false} />);

    expect(html).toContain('Claude');
    expect(html).toContain('OpenClaw');
    expect(html).toContain('OpenCode');
    expect(html).toContain('Hermes');
    expect(html).toContain('运行中');
    expect(html).toContain('完成');
    expect(html).toContain('等待确认');
    expect(html).toContain('待命');
    expect(html).toContain('2m'); // 运行时长
    expect(html).toContain('agent-light-dot');
  });

  it('收起状态下只显示圆点+名称，隐藏状态和时长', () => {
    const html = renderJSX(<AgentLight items={items} collapsed={true} />);

    expect(html).toContain('agent-light-collapsed');
    expect(html).toContain('Claude');
    // 展开状态下才有的元素在收起时不应出现
    expect(html).not.toContain('agent-light-status');
    expect(html).not.toContain('agent-light-elapsed');
  });

  it('空 items 不渲染任何内容', () => {
    const html = renderJSX(<AgentLight items={[]} collapsed={false} />);
    expect(html).toBe('');
  });

  it('最多显示 5 个 Agent', () => {
    const manyItems: AgentLightItem[] = Array.from({ length: 7 }, (_, i) => ({
      kind: 'claude-code',
      name: `Agent ${i}`,
      status: 'idle' as const
    }));
    const html = renderJSX(<AgentLight items={manyItems} collapsed={false} />);
    // 只渲染 5 个
    expect(html.match(/agent-light-row/g)?.length).toBe(5);
  });
});
