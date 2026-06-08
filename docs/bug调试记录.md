# Bug 调试记录

## 1. `-webkit-app-region: drag` 阻断所有 JS 鼠标事件

**现象**：桌宠无法拖拽、单击、双击、右键，所有鼠标交互失效。

**根因**：Electron 的 CSS `-webkit-app-region: drag` 在 OS 层面拦截所有 DOM 事件（click/dblclick/contextmenu/mousedown/mouseup），JS 层收不到任何鼠标事件。

**修复**：彻底放弃 `-webkit-app-region: drag`，改用纯 JS 手动移窗——`mousedown` 注册 `window.addEventListener('mousemove/mouseup')`，mousemove 时通过 IPC `app:move-window` 调 `BrowserWindow.setPosition(dx, dy)`。

**教训**：Electron 拖拽区域 ≠ DOM 可交互区域，二者互斥。桌宠这种"既要拖拽又要点击"的场景，必须走 JS 手动方案。

---

## 2. 测试和实现是两个独立代码

**现象**：`usePetInteraction` hook 的鼠标交互 bug 多轮修不好，但测试全绿。

**根因**：测试文件 `petInteraction.test.ts` 里自己写了一套 `InteractionDecider` 纯函数类，和 `usePetInteraction.ts` 里的 hook **完全没有代码共享**。测试通过只说明测试里的理想化实现正确，不代表 hook 正确。

**修复**：提取纯逻辑到 `interactionDecider.ts`，hook 和测试都 import 同一个模块。测试不再自己造轮子。

**教训**：测试必须 import 被测模块。测试文件里另写一套实现 = 自欺欺人。

---

## 3. Hook 双击永不触发——decider 每次 mousedown 重建

**现象**：双击桌宠无反应。

**根因**：`usePetInteraction` 中 `onMouseDown` 每次执行 `const decider = createInteractionDecider(...)`，新建实例的 `clickCount` 从 0 开始。第一次点击的 `clickCount=1` 存在实例 A 里，第二次 mousedown 又 new 实例 B（clickCount=0），双击窗口内的两次 click 永远拼不到同一个实例上。

**修复**：`useRef(createInteractionDecider(callbacksRef))` 只创建一次，回调通过 `{ current: DeciderCallbacks }` ref 模式透传最新值。

**教训**：useState/useRef 初始化值只在首次渲染执行。每次 render 都在函数体内 `new Xxx()` = 状态丢失。

---

## 4. Claude Code Hook 输出编码混搭

**现象**：WSL 发现返回的 distro 名和 home 路径都是乱码。

**根因**：`wsl.exe` 不同子命令输出不同编码：
- `wsl.exe -l -q` 输出 **UTF-16LE**
- `wsl.exe -d <distro> -- <cmd>` 输出 **UTF-8**

用 `execSync(..., { encoding: 'utf8' })` 解析 UTF-16LE 会得到乱码。

**修复**：`execFileSync` 用 `encoding: 'buffer'`，对 `-l -q` 结果调 `toString('utf16le')`，对 `-d` 结果调 `toString('utf8')`。不用 shell。

**教训**：Windows 命令行工具的输出编码不统一（UTF-16LE vs UTF-8 vs 当前代码页），永远用 Buffer + 显式编码。

---

## 5. `$HOME` 被 cmd.exe 吞掉

**现象**：`wsl.exe -d Ubuntu-24.04 -- echo $HOME` 返回空或乱码。

**根因**：`execSync` 在 Windows 上默认走 `cmd.exe`，`$HOME` 被 cmd 当成变量（不存在则为空）。即使不用 shell，`execSync` 的引号处理也可能把 `$HOME` 当字面量传给 wsl.exe，但 WSL 内的 shell 不展开。

**修复**：改用 `execFileSync('wsl.exe', ['-d', distro, '--', 'sh', '-c', 'echo $HOME'])` —— 明确的 shell 调用，`$HOME` 在 WSL 的 sh 里展开。同时避免了 cmd.exe 的干扰。

**教训**：跨平台调 shell 命令时，`execSync` vs `execFileSync`、shell vs no-shell、引号转义，三者必须对齐。最稳方案：`execFileSync` + 数组参数 + 显式指定目标 shell。

---

## 6. 端口 17371 冲突导致服务器回退到随机端口

**现象**：ingest 服务器不可达，curl 17371 超时或 502。

**根因**：多轮重启后旧 Electron 进程没杀干净，端口 17371 被占用。`AgentEventIngestServer.listen(17371)` 失败后 fallback 到 `listen(0)`（随机端口），但配置文件里的 endpoint 仍是旧的 17371，hook 命令指向了错误的端口。

**修复**：
1. 服务器启动后写 `userData/desk-pet-agent-endpoint.txt` 记录实际端口
2. Hook 命令构建时从 installer options 读取 `agentEventIngestServer.endpoint`（总是最新端口）

**教训**：固定端口在开发环境会冲突。服务端口必须可发现（写文件/注册表/环境变量），不能硬编码或假设不变。

---

## 7. WSL 路径和 Windows 路径不能混用

**现象**：Claude Code hook 报 `Cannot find module '/mnt/c/.../C:\Users\...'`。

**根因**：Electron 进程是 Windows `.exe`，`homedir()` 返回 `C:\Users\13371`。bridge 脚本路径用 Windows 格式写入 `settings.json`。但 Claude Code 在 WSL 内运行，`node` 无法解析 `C:\` 路径，当相对路径拼接 CWD，变成 `/mnt/c/.../C:\Users\...`。

**修复（最终方案）**：放弃外部文件，hook 命令改为内联 `node -e "...inline JS..."` ——零文件依赖，跨平台通用。

**教训**：WSL + Electron 是双 OS 环境。任何文件路径在传给另一端之前必须转换。如果目标是消除路径依赖，内联脚本是最彻底的方案。

---

## 8. 删方法后不清理引用→启动崩溃

**现象**：应用启动后 ingest 服务器未创建，`UnhandledPromiseRejectionWarning: this.getMarker is not a function`。

**根因**：简化 `agentHookInstaller` 时删了 `getMarker()` 方法，但 `isClaudeHookInstalled()` 和 `buildCommand()` 仍在调用它。`getStatus()` 在 `app.whenReady()` 中同步调用，异常未被 catch，导致整个启动链中断——ingest server、IPC handler、窗口创建全都没执行。

**修复**：用 `hookMarker` 常量和 `buildIntegrationId()` 内联替代 `getMarker()`。

**教训**：删方法前先 grep 全项目引用。TypeScript 不会报"方法不存在于 this"的错误（因为 JS 动态性），只能靠运行时发现。

---

## 调试方法论教训

1. **先看日志**：`tail -f /tmp/desk-pet.log | grep -v "GPU\|Cache"` 能看到真正的崩溃信息
2. **分步验证**：先 `curl` 测端口 → 再 `node -e` 测内联脚本 → 最后点"接入"写 hooks
3. **测试必须测真实模块**：不要另起炉灶写纯函数测试
4. **跨平台编码**：永远 `encoding: 'buffer'` + 显式 `toString('utf16le'/'utf8')`
5. **端口冲突**：开发环境用随机端口 + 写文件发现，不要假设固定端口
6. **WSL+Windows**：路径不能混用，用内联或 WSL UNC 路径（`\\wsl$\`）做文件 IO
