/**
 * Agent 状态指示灯
 *
 * 和桌宠在同一个窗口内，绝对定位在桌宠旁边。
 * 每个 Agent 一行：颜色灯 + 名称 + 状态 + 时长。
 */
import type { AgentStatus, AgentKind } from '../../../shared/types';

export interface AgentLightItem {
  kind: AgentKind;
  name: string;
  status: AgentStatus | 'idle';
  title?: string;
  runningSince?: string;
}

interface AgentLightProps {
  items: AgentLightItem[];
  collapsed: boolean;
}

const statusColor: Record<string, string> = {
  running: '#3b82f6',
  waiting_permission: '#f59e0b',
  completed: '#22c55e',
  failed: '#ef4444',
  idle_too_long: '#f97316',
  idle: '#94a3b8',
  started: '#93c5fd'
};

const statusLabel: Record<string, string> = {
  started: '启动',
  running: '运行中',
  waiting_permission: '等待确认',
  completed: '完成',
  failed: '失败',
  idle_too_long: '卡住',
  idle: '待命'
};

const kindLabel: Record<string, string> = {
  'claude-code': 'Claude',
  codex: 'Codex',
  trae: 'Trae',
  openclaw: 'OpenClaw',
  opencode: 'OpenCode',
  hermes: 'Hermes',
  terminal: 'Terminal'
};

function elapsed(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h`;
}

export function AgentLight({ items, collapsed }: AgentLightProps): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <div className={`agent-light${collapsed ? ' agent-light-collapsed' : ''}`}>
      {items.slice(0, 5).map((item) => (
        <div className="agent-light-row" key={item.kind} title={item.title ?? `${kindLabel[item.kind] ?? item.name} — ${statusLabel[item.status]}`}>
          <span
            className="agent-light-dot"
            style={{ background: statusColor[item.status] ?? '#94a3b8' }}
          />
          <span className="agent-light-name">{kindLabel[item.kind] ?? item.name}</span>
          <span className="agent-light-status">{statusLabel[item.status]}</span>
          {item.runningSince ? <span className="agent-light-elapsed">{elapsed(item.runningSince)}</span> : null}
        </div>
      ))}
    </div>
  );
}
