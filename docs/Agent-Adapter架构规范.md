# Agent Adapter 架构规范（BDD）

## 架构目标

桌宠不直接依赖任何一个 AI Agent 工具的内部实现。所有 Agent 集成通过统一的 `AgentAdapter` 接口完成。

```
AgentEventIngestServer (HTTP 接收)
        │
AgentRegistry (统一查询)
        │
┌───────┼───────┬──────────┐
Claude  OpenClaw OpenCode  Hermes ...  (每个都是 Adapter)
```

## Adapter 接口

```ts
interface AgentAdapter {
  kind: AgentKind;       // 唯一标识
  name: string;          // 显示名
  discover(): DiscoveredAgentInstallation[];
  install(target, endpoint, token): void;
  remove(target): void;
  normalize(raw: unknown): NormalizedAgentEvent;
  isInstalled(target): boolean;
}
```

---

## Feature 1: 自动发现 Agent 安装位置

**As a** 用户
**I want to** 启动桌宠后自动看到本机安装了哪些 AI Agent
**So that** 不需要手动配置路径

### Scenario 1.1: 跨平台扫描
**Given** 用户在 Windows/WSL/Linux 任一平台
**When** 桌宠启动
**Then** 列出本机所有已安装 Agent 的位置（含 Windows 原生 + WSL 发行版）
**And** 已存在配置文件的排在前面

### Scenario 1.2: WSL 检测
**Given** 用户在 Windows 上，WSL 中安装了 Claude Code
**When** 桌宠运行 `wsl.exe -l -q` 枚举发行版
**Then** 发现 WSL 发行版中的 `.claude/settings.json`
**And** 标注来源为 `wsl`

---

## Feature 2: 一键接入 Agent

**As a** 用户
**I want to** 选择一个发现的 Agent 并点击接入
**So that** 桌宠开始监听该 Agent 的状态

### Scenario 2.1: Claude Code Hook 安装
**Given** 用户选择了 Claude Code 的某个安装位置
**When** 用户点击"接入"
**Then** `~/.claude/settings.json` 的 `hooks` 字段被写入 8 个事件的监听命令
**And** bridge 脚本被写入 `.desk-pet/agent-hook-bridge.mjs`
**And** 安装状态在 UI 中更新为"已接入"

### Scenario 2.2: OpenClaw 接入
**Given** 用户选择了 OpenClaw 的安装位置
**When** 用户点击"接入"
**Then** 桌宠开始通过日志尾随方式监听 OpenClaw 状态
**And** 不修改 OpenClaw 的任何配置文件

### Scenario 2.3: 一键移除
**Given** 桌宠已接入某个 Agent
**When** 用户点击"移除"
**Then** 配置文件中的 hook/监听被清除
**And** 不影响该 Agent 的其他配置

---

## Feature 3: 统一状态标准化

**As a** 系统
**I want to** 不同 Agent 的原始事件统一转换为标准 AgentStatus
**So that** 桌宠和指示灯不需要知道原始事件格式

### Scenario 3.1: Claude Stop → completed
**Given** Claude Code 发送 `hook_event_name: "Stop"` 事件
**When** `claudeAdapter.normalize(raw)` 被调用
**Then** 返回 `{ status: "completed", priority: "high" }`

### Scenario 3.2: OpenClaw status → completed
**Given** OpenClaw 发送 `{ status: "done" }` 事件
**When** `openclawAdapter.normalize(raw)` 被调用
**Then** 返回 `{ status: "completed", priority: "high" }`

### Scenario 3.3: 未知状态兜底
**Given** 收到无法识别的状态值
**When** 任意 adapter 的 normalize 被调用
**Then** 返回 `{ status: "running" }` 作为默认值

---

## Feature 4: 状态指示灯

**As a** 用户
**I want to** 一眼看到所有已接入 Agent 的当前状态
**So that** 不需要打开面板就能知道 Agent 在做什么

### Scenario 4.1: 多 Agent 同时显示
**Given** 已接入 Claude Code、OpenClaw、Hermes 三个 Agent
**When** Claude 运行中、OpenClaw 完成、Hermes 待命
**Then** 指示灯分别显示蓝灯/绿灯/灰灯
**And** 每行显示 Agent 名称 + 状态文字 + 运行时长

### Scenario 4.2: 面板收起时简化显示
**Given** 用户关掉了聊天面板
**When** 面板收起
**Then** 指示灯只显示圆点 + Agent 名称（隐藏状态文字和时长）
**And** 指示灯宽度缩小

### Scenario 4.3: 无接入 Agent 时隐藏
**Given** 没有接入任何 Agent
**When** 也没有 Agent 任务记录
**Then** 指示灯不显示

---

## Feature 5: 指示灯与桌宠联动

**As a** 系统
**I want to** 指示灯和桌宠在同一窗口内
**So that** 它们一起拖拽、一起隐藏、始终粘在一起

### Scenario 5.1: 拖拽联动
**Given** 用户拖拽桌宠
**When** 窗口移动
**Then** 指示灯跟随移动（因为是同一个 DOM 内的绝对定位元素）

### Scenario 5.2: 隐藏联动
**Given** 用户通过托盘隐藏桌宠
**When** 窗口 hide
**Then** 指示灯也一起隐藏
