# 赛博宇的桌面AI宠物

赛博宇的桌面AI宠物是一个面向 AI先锋使用者的桌面 AI 分身。它以桌宠形象常驻 Windows 桌面，支持 DeepSeek 文字聊天、待办提醒、Agent 状态提醒和一键分享图，先从“帮用户盯 AI Agent 工作状态”这个高频场景切入。

## 项目定位

一句话：

```text
一个住在桌面上的 AI 宠物，陪你工作，提醒你任务，帮你盯 AI Agent 跑完没有。
```

目标用户：

- 国内 AI先锋使用者。
- 高频尝试 AI 工具的人。
- 使用 DeepSeek、Claude Code、Codex、Trae、小龙虾 OpenClaw 等工具的人。
- 需要桌面陪伴、待办提醒、AI 工作流展示和分享的人。

## MVP 核心链路

```text
桌宠常驻
  + DeepSeek 聊天
  + 待办提醒
  + Agent 状态提醒
  + 分享图
```

第一版要跑通这条演示路径：

1. 用户启动桌宠。
2. 桌宠显示默认形象，并可拖拽移动。
3. 用户配置 DeepSeek API Key。
4. 用户和桌宠聊天，并创建一个待办提醒。
5. 用户触发 Agent 状态模拟器，或在内测增强版中使用真实 Agent Watcher。
6. Agent 等待确认或完成时，桌宠切换状态并提醒。
7. 用户生成分享图，预览脱敏内容后保存。

## 技术栈

```text
桌面框架：Electron
前端：React + TypeScript + Vite
构建：electron-vite
桌宠渲染：Canvas Sprite
本地存储：electron-store 起步，后续升级 SQLite
大模型：DeepSeek API
平台：Windows first
```

核心原则：

- Electron Main 负责系统能力。
- React 负责界面。
- TypeScript 负责核心模型和协议约束。
- Canvas 负责桌宠动画。
- Preload 负责安全桥。
- Event Bus 负责事件通道。
- 各模块拥有自己的业务状态。

## 文档导航

建议阅读顺序：

1. [产品功能文档.md](./产品功能文档.md)：产品定位、功能范围和商业化。
2. [MVP范围与验收标准.md](./MVP范围与验收标准.md)：第一版做什么、不做什么、怎么验收。
3. [技术实现方案.md](./技术实现方案.md)：技术选型、模块边界、Electron 安全和性能约束。
4. [系统架构设计.md](./系统架构设计.md)：进程模型、模块图、事件流和状态所有权。
5. [数据模型与事件协议.md](./数据模型与事件协议.md)：核心类型、事件名、IPC 通道和协议字段。
6. [AgentWatcher设计.md](./AgentWatcher设计.md)：Agent 状态监听、标准化和兜底策略。
7. [UI交互设计.md](./UI交互设计.md)：桌宠、气泡、提醒、设置页和分享页交互。
8. [安全与隐私设计.md](./安全与隐私设计.md)：Electron 安全、API Key、脱敏、插件权限和日志策略。
9. [开发计划.md](./开发计划.md)：分阶段开发任务和验收顺序。

## 当前阶段

当前处于产品和技术方案设计阶段，尚未进入正式编码。

第一阶段目标：

- 搭建 Electron + React + TypeScript 项目。
- 实现透明置顶桌宠窗口。
- 实现 Canvas 待机动画。
- 实现 DeepSeek 聊天气泡。
- 实现待办提醒。
- 实现 Agent 状态模拟器。
- 实现静态分享图。

## 不做事项

MVP 坚决不做：

- macOS 支持。
- Linux 深度适配。
- Live2D。
- 3D VRM。
- GIF/MP4 导出。
- 开放插件市场。
- 复杂长期记忆。
- 多模型供应商。
- 屏幕 OCR 识别 Agent 状态。
- 大而全任务管理系统。
