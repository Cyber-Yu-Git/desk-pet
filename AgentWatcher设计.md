# AgentWatcher设计

## 1. 目标

Agent Watcher 是本产品的差异化核心。它负责观察 AI Agent 的运行状态，并把不同来源的状态统一成标准事件，让桌宠能够及时提醒用户。

目标：

- 识别 Agent 是否开始、运行中、等待确认、完成、失败、疑似卡住。
- 状态统一转换为 `AgentEvent`。
- 优先支持稳定、低成本、非侵入式监听。
- 不依赖屏幕 OCR。
- 不为了首版兼容所有 Agent。

## 2. 支持对象

P0：

- Agent 状态模拟器。
- 手动“帮我盯这个任务”兜底入口。

P0.5 / 内测增强：

- Claude Code / Codex / Trae / 小龙虾 OpenClaw 中选择一个状态来源最稳定的工具，打通真实集成。
- 普通终端任务兜底。

P1：

- 第一个真实 Agent Watcher 稳定化。
- Trae。
- 小龙虾 OpenClaw。
- 第二个真实 Agent 工具。

P2：

- 写作 Agent。
- 浏览器 Agent。
- 设计 Agent。
- 自动化工作流。
- GitHub Actions / CI。

## 3. 状态定义

```ts
export type AgentStatus =
  | 'started'
  | 'running'
  | 'waiting_permission'
  | 'completed'
  | 'failed'
  | 'idle_too_long';
```

含义：

- `started`：Agent 会话开始。
- `running`：Agent 正在运行或思考。
- `waiting_permission`：Agent 等待用户确认、授权或输入。
- `completed`：Agent 任务完成。
- `failed`：Agent 报错或失败。
- `idle_too_long`：长时间无状态变化，疑似卡住。

## 4. 标准事件

所有来源必须转成：

```ts
export interface AgentEvent {
  id: string;
  type: 'agent.started' | 'agent.running' | 'agent.waiting_permission' | 'agent.completed' | 'agent.failed' | 'agent.idle_too_long';
  source: 'agent-watcher';
  agent: 'claude-code' | 'codex' | 'trae' | 'openclaw' | 'terminal';
  sessionId: string;
  status: AgentStatus;
  message?: string;
  projectPath?: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
}
```

事件流：

```text
Raw Source
  -> Adapter
  -> Normalizer
  -> AgentEvent
  -> EventBus
  -> PetEngine / NotificationService / ShareService
```

## 5. 监听优先级

```text
插件主动上报
  > 终端桥接
  > 日志监听
  > 进程/窗口低频检测
  > 用户手动兜底
```

### 5.1 插件主动上报

最可靠方案。Agent 工具或桥接脚本主动发送状态事件。

优点：

- 准确。
- 延迟低。
- 不需要猜测。

缺点：

- 需要工具配合。
- 首版未必能直接支持。

### 5.2 终端桥接

为 CLI Agent 包一层启动命令，捕获输入输出和退出状态。

示例：

```text
desk-pet-watch claude
desk-pet-watch codex
```

P0 可以先不做真实命令，但设计上要保留。

### 5.3 日志监听

监听 Agent 产生的日志、JSONL、状态文件。

注意：

- 不要把某个路径假设为稳定事实。
- 所有路径都必须经过验证。
- 日志格式变化时要降级。

### 5.4 进程/窗口低频检测

用于兜底判断 started/completed。

规则：

- 禁止高频扫描。
- 默认 10-60 秒级别检测。
- 不承诺 500ms 响应。
- 不能用于强提醒状态。

### 5.5 手动兜底

用户可以右键桌宠选择：

```text
帮我盯这个任务
```

手动模式下：

- 桌宠进入 working。
- 用户可手动标记完成。
- 超时后提醒用户检查。

## 6. 响应时间目标

不同来源目标不同：

```text
主动上报 / 日志尾随：< 500ms
终端桥接：< 1s
窗口标题检测：5-10s
进程低频检测：10-60s
手动兜底：用户触发
```

不要用 `<500ms` 要求所有监听方式。

## 7. Agent 模拟器

P0 先实现 Agent Simulator。

功能：

- 手动触发 `started`。
- 手动触发 `running`。
- 手动触发 `waiting_permission`。
- 手动触发 `completed`。
- 手动触发 `failed`。
- 查看事件历史。

目的：

- 先验证桌宠状态反应。
- 先验证提醒优先级。
- 先验证分享入口。
- 避免真实 Agent 集成阻塞 P0。

## 8. 首个真实集成

选择标准：

- 状态来源稳定。
- 能识别至少 3 种状态。
- 不需要屏幕 OCR。
- 不需要破解私有协议。
- 国内用户或 AI先锋用户有使用价值。

验收：

- 能识别 started。
- 能识别 running 或 waiting_permission。
- 能识别 completed 或 failed。
- 状态转换为标准 AgentEvent。
- 失败时不影响桌宠主流程。

## 9. 与桌宠的关系

Agent Watcher 不直接控制桌宠。

它只发事件：

```text
agent.started
agent.running
agent.waiting_permission
agent.completed
agent.failed
agent.idle_too_long
```

Pet Engine 自己决定：

- 播放什么动画。
- 气泡文案。
- 是否插队。
- 是否触发分享入口。

## 10. 不做事项

MVP 不做：

- 屏幕 OCR。
- 截图识别 Agent 状态。
- 同时适配所有工具。
- 后台高频扫描进程。
- 破解工具私有协议。
- 自动读取用户项目内容。

## 11. 风险

风险：Agent 工具没有稳定状态 API。

对策：

- 模拟器先跑通体验。
- 手动兜底入口。
- 优先集成有日志或可桥接的工具。
- 所有来源都转标准 AgentEvent。

风险：误提醒。

对策：

- 强提醒只用于高置信度状态。
- 低置信度状态只用轻气泡。
- 事件中增加 priority。
- 后续增加 confidence 字段。
