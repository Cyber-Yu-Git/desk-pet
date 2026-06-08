import { useEffect, useState } from 'react';
import { EventNames } from '../../shared/eventNames';
import type {
  AppPanel,
  AgentHookStatus,
  AgentKind,
  DiscoveredClaudeCode,
  AgentStatus,
  AgentTask,
  ChatMessage,
  DataLocationInfo,
  DeepSeekConfig,
  MemoryItem,
  MemoryKind,
  PetEvent,
  PetState,
  Todo
} from '../../shared/types';
import { PetCanvas } from './pet/PetCanvas';
import { usePetInteraction } from './pet/usePetInteraction';
import { AgentLight, type AgentLightItem } from './agent/AgentLight';

const stateLabels: Record<PetState, string> = {
  idle: '待机',
  working: '工作中',
  reminding: '提醒',
  success: '完成',
  error: '出错',
  waiting: '等待',
  sleeping: '休息',
  sharing: '分享'
};

const onboardingDismissedStorageKey = 'cyber-yu-desk-pet:onboarding-dismissed';

export function App(): React.JSX.Element {
  const [petState, setPetState] = useState<PetState>('idle');
  const [version, setVersion] = useState<string>('');
  const [activePanel, setActivePanel] = useState<AppPanel>('chat');
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoTitle, setTodoTitle] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState('10');
  const [todoError, setTodoError] = useState('');
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentError, setAgentError] = useState('');
  const [agentHookStatus, setAgentHookStatus] = useState<AgentHookStatus | null>(null);
  const [discoveredAgents, setDiscoveredAgents] = useState<{ kind: AgentKind; name: string; installations: DiscoveredClaudeCode[] }[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, DiscoveredClaudeCode>>({});
  const [sharePreviewUrl, setSharePreviewUrl] = useState('');
  const [shareSavedPath, setShareSavedPath] = useState('');
  const [shareError, setShareError] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryKind, setMemoryKind] = useState<MemoryKind>('preference');
  const [memoryTags, setMemoryTags] = useState('');
  const [memoryError, setMemoryError] = useState('');
  const [deepSeekConfig, setDeepSeekConfig] = useState<DeepSeekConfig | null>(null);
  const [deepSeekApiKey, setDeepSeekApiKey] = useState('');
  const [deepSeekModel, setDeepSeekModel] = useState('deepseek-chat');
  const [dataLocation, setDataLocation] = useState<DataLocationInfo | null>(null);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => window.localStorage.getItem(onboardingDismissedStorageKey) === 'true'
  );

  const cycleStates: PetState[] = ['idle', 'working', 'success', 'sleeping'];

  function cyclePetState(): void {
    const idx = cycleStates.indexOf(petState);
    setPetState(cycleStates[(idx + 1) % cycleStates.length]);
  }

  function toggleChatPanel(): void {
    if (panelOpen && activePanel === 'chat') {
      setPanelOpen(false);
    } else {
      setActivePanel('chat');
      setPanelOpen(true);
    }
  }

  const petInteraction = usePetInteraction({
    onSingleClick: cyclePetState,
    onDoubleClick: toggleChatPanel,
    onHoverStart: () => setIsHovering(true),
    onHoverEnd: () => setIsHovering(false),
    onContextMenu: (event) => {
      event.preventDefault();
      void window.deskPet.app.showContextMenu();
    }
  });

  useEffect(() => {
    void window.deskPet.app.getVersion().then(setVersion);
    void refreshChatHistory();
    void refreshTodos();
    void refreshAgentTasks();
    void refreshAgentHookStatus();
    void refreshMemories();
    void refreshSettings();

    const removePetListener = window.deskPet.events.onPetEvent((event: PetEvent) => {
      if (event.type === EventNames.PetStateChange) {
        setPetState(event.state);

        if (event.state === 'reminding') {
          setActivePanel('todo');
          setPanelOpen(true);
          void refreshTodos();
        }

        if (event.reason?.startsWith('agent-hook:')) {
          void refreshAgentTasks();
          void refreshAgentHookStatus();
        }
      }
    });

    const removeOpenPanelListener = window.deskPet.events.onOpenPanel((panel: AppPanel) => {
      setActivePanel(panel);
      setPanelOpen(true);

      if (panel === 'agent') {
        void refreshAgentTasks();
        void refreshAgentHookStatus();
      }
    });
    const removeCollapsePanelListener = window.deskPet.events.onCollapsePanel(() => setPanelOpen(false));
    const removeQuitListener = window.deskPet.events.onQuitRequest(() => {
      void window.deskPet.app.quit();
    });

    return () => {
      removePetListener();
      removeOpenPanelListener();
      removeCollapsePanelListener();
      removeQuitListener();
    };
  }, []);

  async function refreshChatHistory(): Promise<void> {
    const result = await window.deskPet.chat.getHistory();

    if (result.ok) {
      setMessages(result.data);
    }
  }

  async function refreshTodos(): Promise<void> {
    const result = await window.deskPet.todos.list();

    if (result.ok) {
      setTodos(result.data);
    }
  }

  async function refreshAgentTasks(): Promise<void> {
    const result = await window.deskPet.agents.listTasks();

    if (result.ok) {
      setAgentTasks(result.data);
    }
  }

  async function refreshAgentHookStatus(): Promise<void> {
    const [statusResult, discoverResult] = await Promise.all([
      window.deskPet.agents.getHookStatus(),
      window.deskPet.agents.discoverClaudeCode() as Promise<{ ok: boolean; data: { kind: AgentKind; name: string; installations: DiscoveredClaudeCode[] }[] }>
    ]);

    if (statusResult.ok) setAgentHookStatus(statusResult.data);
    if (discoverResult.ok) {
      setDiscoveredAgents(discoverResult.data);
      const targets: Record<string, DiscoveredClaudeCode> = {};
      for (const agent of discoverResult.data) {
        const best = agent.installations.find((i) => i.exists) ?? agent.installations[0];
        if (best) targets[agent.kind] = best;
      }
      setSelectedTargets((prev) => ({ ...targets, ...prev }));
    }
  }

  async function refreshMemories(): Promise<void> {
    const result = await window.deskPet.memory.list();

    if (result.ok) {
      setMemories(result.data);
    }
  }

  async function refreshSettings(): Promise<void> {
    const [configResult, dataLocationResult] = await Promise.all([
      window.deskPet.settings.getDeepSeekConfig(),
      window.deskPet.settings.getDataLocation()
    ]);

    if (configResult.ok) {
      setDeepSeekConfig(configResult.data);
      setDeepSeekModel(configResult.data.model);

      if (!configResult.data.apiKeyConfigured && !onboardingDismissed) {
        setPetState('waiting');
      }
    }

    if (dataLocationResult.ok) {
      setDataLocation(dataLocationResult.data);
    }
  }

  async function sendMessage(): Promise<void> {
    if (isSending) {
      return;
    }

    const content = draft.trim();

    if (!content) {
      setChatError('先输入一句话。');
      return;
    }

    setDraft('');
    setIsSending(true);
    setChatError('');

    const result = await window.deskPet.chat.sendMessage({ content });

    if (result.ok) {
      setMessages(result.data.messages);
      setPetState('success');
    } else {
      setChatError(result.error.message);
      setPetState('error');
      await refreshChatHistory();
    }

    setIsSending(false);
  }

  async function createTodo(): Promise<void> {
    const title = todoTitle.trim();

    if (!title) {
      setTodoError('先写一个待办。');
      return;
    }

    const minutes = Number(reminderMinutes);
    const remindAt =
      Number.isFinite(minutes) && minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : undefined;

    const result = await window.deskPet.todos.create({ title, remindAt });

    if (result.ok) {
      setTodoTitle('');
      setTodoError('');
      setPetState(remindAt ? 'reminding' : 'success');
      await refreshTodos();
    } else {
      setTodoError(result.error.message);
      setPetState('error');
    }
  }

  async function completeTodo(id: string): Promise<void> {
    const result = await window.deskPet.todos.complete(id);

    if (result.ok) {
      setTodos(result.data);
      setPetState('success');
    }
  }

  async function deleteTodo(id: string): Promise<void> {
    const result = await window.deskPet.todos.delete(id);

    if (result.ok) {
      setTodos(result.data);
      setPetState('idle');
    }
  }

  async function installAgentHook(kind: AgentKind): Promise<void> {
    setAgentError('');
    const target = selectedTargets[kind];
    const result = await window.deskPet.agents.installClaudeHook(
      target ? { settingsPath: target.settingsPath, scope: target.scope, scopePath: target.scopePath } : undefined
    );

    if (result.ok) {
      setAgentHookStatus(result.data);
      setPetState('success');
      await refreshAgentHookStatus();
    } else {
      setAgentError(result.error.message);
      setPetState('error');
    }
  }

  async function removeAgentHook(kind: AgentKind): Promise<void> {
    setAgentError('');
    const target = selectedTargets[kind];
    const result = await window.deskPet.agents.removeClaudeHook(
      target ? { settingsPath: target.settingsPath, scope: target.scope, scopePath: target.scopePath } : undefined
    );

    if (result.ok) {
      setAgentHookStatus(result.data);
      setPetState('idle');
      await refreshAgentHookStatus();
    } else {
      setAgentError(result.error.message);
      setPetState('error');
    }
  }

  async function generateShareImage(): Promise<void> {
    setShareError('');
    setShareSavedPath('');

    try {
      const dataUrl = createShareCardDataUrl({
        petState,
        messages,
        todos,
        agentTasks
      });
      setSharePreviewUrl(dataUrl);
      setPetState('sharing');

      const result = await window.deskPet.share.generate({
        dataUrl,
        fileName: `cyber-yu-share-${Date.now()}.png`
      });

      if (result.ok) {
        setShareSavedPath(result.data.filePath);
      } else {
        setShareError(result.error.message);
        setPetState('error');
      }
    } catch (error) {
      setShareError(error instanceof Error ? error.message : '生成分享图失败。');
      setPetState('error');
    }
  }

  async function createMemory(): Promise<void> {
    const content = memoryContent.trim();

    if (!content) {
      setMemoryError('先写一条要记住的内容。');
      return;
    }

    const tags = memoryTags
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const result = await window.deskPet.memory.create({
      kind: memoryKind,
      content,
      tags,
      confidence: 0.8
    });

    if (result.ok) {
      setMemoryContent('');
      setMemoryTags('');
      setMemoryError('');
      setPetState('success');
      await refreshMemories();
    } else {
      setMemoryError(result.error.message);
      setPetState('error');
    }
  }

  async function deleteMemory(id: string): Promise<void> {
    const result = await window.deskPet.memory.delete(id);

    if (result.ok) {
      setMemories(result.data);
    }
  }

  async function saveDeepSeekSettings(): Promise<void> {
    setSettingsError('');
    setSettingsMessage('');

    const result = await window.deskPet.settings.updateDeepSeekConfig({
      apiKey: deepSeekApiKey,
      model: deepSeekModel
    });

    if (result.ok) {
      setDeepSeekConfig(result.data);
      setDeepSeekApiKey('');
      setSettingsMessage(result.data.apiKeyConfigured ? 'DeepSeek 设置已保存。' : 'DeepSeek Key 已清空。');
      if (result.data.apiKeyConfigured) {
        dismissOnboarding();
      }
      setPetState('success');
    } else {
      setSettingsError(result.error.message);
      setPetState('error');
    }
  }

  async function openDataLocation(): Promise<void> {
    const result = await window.deskPet.settings.openDataLocation();

    if (!result.ok) {
      setSettingsError(result.error.message);
    }
  }

  async function clearChatHistory(): Promise<void> {
    const result = await window.deskPet.settings.clearChatHistory();

    if (result.ok) {
      setMessages(result.data);
      setSettingsMessage('聊天历史已清空。');
    }
  }

  async function clearMemories(): Promise<void> {
    const result = await window.deskPet.settings.clearMemories();

    if (result.ok) {
      setMemories(result.data);
      setSettingsMessage('长期记忆已清空。');
    }
  }

  function dismissOnboarding(): void {
    window.localStorage.setItem(onboardingDismissedStorageKey, 'true');
    setOnboardingDismissed(true);
  }

  function startFirstAgentDemo(): void {
    setActivePanel('agent');
    setPanelOpen(true);
    setAgentTitle('检查 DeepSeek 聊天是否可用');
  }

  const lightItems: AgentLightItem[] = (agentHookStatus?.integrations ?? [])
    .filter((i) => i.installed)
    .map((i) => {
      const agentSessionTasks = agentTasks.filter((t) => t.source === 'watcher' && t.agent === i.agent);
      const runningCount = agentSessionTasks.filter((t) => t.status === 'running' || t.status === 'started').length;
      const latestRunning = agentSessionTasks.find((t) => t.status === 'running' || t.status === 'started');
      const latestAny = agentSessionTasks[0];
      const status: AgentLightItem['status'] = runningCount > 0 ? 'running'
        : latestAny?.status === 'waiting_permission' ? 'waiting_permission'
        : latestAny?.status === 'failed' ? 'failed'
        : latestAny?.status === 'completed' ? 'idle'
        : 'idle';
      return {
        kind: i.agent,
        name: `${i.agent}${runningCount > 0 ? ` ×${runningCount}` : ''}`,
        status,
        title: latestRunning?.title ?? latestAny?.title,
        runningSince: latestRunning?.createdAt
      };
    });

  return (
    <main className="pet-shell">
      <section className={`pet-card ${panelOpen ? 'pet-card-open' : 'pet-card-compact'}`} aria-label="赛博宇桌宠">
        <AgentLight items={lightItems} collapsed={!panelOpen} />
        <div
          className={`pet-stage${isHovering ? ' pet-stage-hover' : ''}`}
          onMouseDown={petInteraction.onMouseDown}
          onMouseLeave={petInteraction.onMouseLeave}
          onContextMenu={petInteraction.onContextMenu}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              toggleChatPanel();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <PetCanvas state={petState} />
        </div>
        {panelOpen ? <div className="pet-bubble">
          <strong>赛博宇</strong>
          <span>{stateLabels[petState]}</span>
        </div> : null}
        {panelOpen ? activePanel === 'chat' ? (
          <section className="tool-panel chat-panel" aria-label="和赛博宇聊天">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <p className="panel-empty">跟我说点什么，我会记住最近的聊天。</p>
              ) : (
                messages.slice(-6).map((message) => (
                  <div className={`chat-message chat-message-${message.role}`} key={message.id}>
                    {message.content}
                  </div>
                ))
              )}
            </div>
            {chatError ? <div className="panel-error">{chatError}</div> : null}
            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <input
                aria-label="聊天输入"
                disabled={isSending}
                maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="问我一句..."
                value={draft}
              />
              <button disabled={isSending} type="submit">
                {isSending ? '...' : '发送'}
              </button>
            </form>
          </section>
        ) : activePanel === 'todo' ? (
          <section className="tool-panel" aria-label="待办提醒">
            <form
              className="todo-form"
              onSubmit={(event) => {
                event.preventDefault();
                void createTodo();
              }}
            >
              <input
                aria-label="待办标题"
                maxLength={120}
                onChange={(event) => setTodoTitle(event.target.value)}
                placeholder="写个待办..."
                value={todoTitle}
              />
              <input
                aria-label="提醒分钟"
                inputMode="numeric"
                max="1440"
                min="1"
                onChange={(event) => setReminderMinutes(event.target.value)}
                type="number"
                value={reminderMinutes}
              />
              <button type="submit">添加</button>
            </form>
            {todoError ? <div className="panel-error">{todoError}</div> : null}
            <div className="todo-list">
              {todos.length === 0 ? (
                <p className="panel-empty">现在没有待办。</p>
              ) : (
                todos.slice(0, 5).map((todo) => (
                  <div className={`todo-item todo-item-${todo.status}`} key={todo.id}>
                    <div>
                      <strong>{todo.title}</strong>
                      <span>{formatTodoTime(todo)}</span>
                    </div>
                    <button
                      aria-label={`完成 ${todo.title}`}
                      disabled={todo.status === 'completed'}
                      onClick={() => void completeTodo(todo.id)}
                      type="button"
                    >
                      ✓
                    </button>
                    <button aria-label={`删除 ${todo.title}`} onClick={() => void deleteTodo(todo.id)} type="button">
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : activePanel === 'agent' ? (
          <section className="tool-panel" aria-label="Agent 管理">
            {agentHookStatus?.serverRunning ? (
              <div className="agent-status-bar">
                <span className="agent-status-dot" />
                监听中 · {agentHookStatus.endpoint}
              </div>
            ) : null}
            {discoveredAgents.map((agent) => {
              const target = selectedTargets[agent.kind];
              const isInstalled = agentHookStatus?.integrations?.some(
                (i) => i.agent === agent.kind && i.installed
              );
              return (
                <div className="agent-connect-row" key={agent.kind}>
                  <div className="agent-connect-info">
                    <span className={`agent-connect-dot ${isInstalled ? 'connected' : ''}`} />
                    <strong>{agent.name}</strong>
                    {target ? (
                      <select
                        className="agent-target-select"
                        value={target.settingsPath}
                        onChange={(e) => {
                          const found = agent.installations.find((i) => i.settingsPath === e.target.value);
                          if (found) setSelectedTargets((prev) => ({ ...prev, [agent.kind]: found }));
                        }}
                      >
                        {agent.installations.map((inst) => (
                          <option key={inst.settingsPath} value={inst.settingsPath}>
                            {inst.label} {inst.source === 'wsl' ? '(WSL)' : ''} {inst.exists ? '✓' : '?'}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  {isInstalled ? (
                    <button className="agent-connect-btn remove" onClick={() => void removeAgentHook(agent.kind)} type="button">移除</button>
                  ) : (
                    <button className="agent-connect-btn" onClick={() => void installAgentHook(agent.kind)} type="button">接入</button>
                  )}
                </div>
              );
            })}
            {agentError ? <div className="panel-error">{agentError}</div> : null}
          </section>
        ) : activePanel === 'share' ? (
          <section className="tool-panel" aria-label="生成分享图">
            <div className="share-preview">
              {sharePreviewUrl ? <img alt="分享图预览" src={sharePreviewUrl} /> : <p className="panel-empty">生成一张今日状态卡。</p>}
            </div>
            {shareError ? <div className="panel-error">{shareError}</div> : null}
            {shareSavedPath ? <div className="share-path">{shareSavedPath}</div> : null}
            <button className="share-button" onClick={() => void generateShareImage()} type="button">
              生成 PNG
            </button>
          </section>
        ) : activePanel === 'memory' ? (
          <section className="tool-panel" aria-label="长期记忆">
            <form
              className="memory-form"
              onSubmit={(event) => {
                event.preventDefault();
                void createMemory();
              }}
            >
              <select
                aria-label="记忆类型"
                onChange={(event) => setMemoryKind(event.target.value as MemoryKind)}
                value={memoryKind}
              >
                <option value="preference">偏好</option>
                <option value="profile">资料</option>
                <option value="project">项目</option>
                <option value="fact">事实</option>
                <option value="note">笔记</option>
              </select>
              <input
                aria-label="记忆内容"
                maxLength={500}
                onChange={(event) => setMemoryContent(event.target.value)}
                placeholder="记住：我喜欢..."
                value={memoryContent}
              />
              <button type="submit">记</button>
            </form>
            <input
              aria-label="记忆标签"
              className="memory-tags-input"
              maxLength={120}
              onChange={(event) => setMemoryTags(event.target.value)}
              placeholder="标签，可选，用空格分隔"
              value={memoryTags}
            />
            {memoryError ? <div className="panel-error">{memoryError}</div> : null}
            <div className="memory-list">
              {memories.length === 0 ? (
                <p className="panel-empty">还没有长期记忆。</p>
              ) : (
                memories.slice(0, 5).map((memory) => (
                  <div className="memory-item" key={memory.id}>
                    <div>
                      <strong>{memoryKindLabels[memory.kind]}</strong>
                      <span>{memory.content}</span>
                    </div>
                    <button aria-label={`删除记忆 ${memory.content}`} onClick={() => void deleteMemory(memory.id)} type="button">
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="tool-panel" aria-label="设置与安全">
            {!deepSeekConfig?.apiKeyConfigured && !onboardingDismissed ? (
              <div className="onboarding-card">
                <strong>先配置 DeepSeek Key</strong>
                <span>保存后就可以聊天；再试一个待办、一个 Agent 状态和一张分享图。</span>
                <div>
                  <button onClick={() => setActivePanel('chat')} type="button">
                    去聊天
                  </button>
                  <button onClick={startFirstAgentDemo} type="button">
                    试 Agent
                  </button>
                  <button onClick={dismissOnboarding} type="button">
                    跳过
                  </button>
                </div>
              </div>
            ) : null}
            <div className="settings-status">
              <span>{deepSeekConfig?.apiKeyConfigured ? 'Key 已配置' : 'Key 未配置'}</span>
              <span>{deepSeekConfig?.encryptionAvailable ? '本机加密可用' : '本机加密不可用'}</span>
            </div>
            <form
              className="settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveDeepSeekSettings();
              }}
            >
              <input
                aria-label="DeepSeek API Key"
                onChange={(event) => setDeepSeekApiKey(event.target.value)}
                placeholder="DeepSeek API Key"
                type="password"
                value={deepSeekApiKey}
              />
              <input
                aria-label="DeepSeek 模型"
                onChange={(event) => setDeepSeekModel(event.target.value)}
                placeholder="deepseek-chat"
                value={deepSeekModel}
              />
              <button type="submit">保存</button>
            </form>
            {settingsError ? <div className="panel-error">{settingsError}</div> : null}
            {settingsMessage ? <div className="settings-message">{settingsMessage}</div> : null}
            <div className="settings-actions">
              <button onClick={() => void openDataLocation()} type="button">
                数据目录
              </button>
              <button onClick={() => void clearChatHistory()} type="button">
                清聊天
              </button>
              <button onClick={() => void clearMemories()} type="button">
                清记忆
              </button>
            </div>
            <div className="settings-path">{dataLocation?.userDataPath ?? '读取数据目录中...'}</div>
          </section>
        ) : null}
        {panelOpen ? <small className="version">v{version || '0.1.0'}</small> : null}
      </section>
    </main>
  );
}

interface ShareCardData {
  petState: PetState;
  messages: ChatMessage[];
  todos: Todo[];
  agentTasks: AgentTask[];
}

function createShareCardDataUrl(data: ShareCardData): string {
  const canvas = document.createElement('canvas');
  const width = 900;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('当前环境无法生成分享图。');
  }

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f8fafc');
  gradient.addColorStop(0.55, '#dbeafe');
  gradient.addColorStop(1, '#dcfce7');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#0f172a';
  context.font = 'bold 52px "Microsoft YaHei UI", sans-serif';
  context.fillText('赛博宇的桌面AI宠物', 72, 120);

  context.font = '28px "Microsoft YaHei UI", sans-serif';
  context.fillStyle = '#334155';
  context.fillText(`当前状态：${stateLabels[data.petState]}`, 72, 170);

  drawPetAvatar(context, 690, 94, data.petState);
  drawCardSection(context, '今日片段', buildShareHighlights(data), 72, 260);

  context.fillStyle = '#475569';
  context.font = '24px "Microsoft YaHei UI", sans-serif';
  context.fillText('cyber-yu-desk-pet · AI先锋使用者的桌面搭子', 72, 1110);

  return canvas.toDataURL('image/png');
}

function buildShareHighlights(data: ShareCardData): string[] {
  const redact = (text: string): string => text.replace(/[A-Za-z]:\\[^\s,]*/g, '[PATH]').replace(/(sk-[a-zA-Z0-9_-]{12,})/g, '[KEY]');

  const latestAgent = data.agentTasks[0];
  const activeTodo = data.todos.find((todo) => todo.status === 'active');
  const latestAssistant = [...data.messages].reverse().find((message) => message.role === 'assistant');

  return [
    latestAgent ? `Agent：${agentLabels[latestAgent.agent]} ${agentStatusLabels[latestAgent.status]} · ${redact(latestAgent.title)}` : 'Agent：等待接入新的任务',
    activeTodo ? `待办：${redact(activeTodo.title)}` : '待办：今天暂时清爽',
    latestAssistant ? `聊天：${truncateText(redact(latestAssistant.content), 54)}` : '聊天：还没有新的对话摘录'
  ];
}

function drawCardSection(context: CanvasRenderingContext2D, title: string, lines: string[], x: number, y: number): void {
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  roundRect(context, x, y, 756, 690, 28);
  context.fill();

  context.fillStyle = '#0f172a';
  context.font = 'bold 36px "Microsoft YaHei UI", sans-serif';
  context.fillText(title, x + 44, y + 72);

  lines.forEach((line, index) => {
    const lineY = y + 160 + index * 150;
    context.fillStyle = index === 0 ? '#eef2ff' : index === 1 ? '#ecfdf5' : '#f8fafc';
    roundRect(context, x + 44, lineY - 48, 668, 104, 20);
    context.fill();
    context.fillStyle = '#0f172a';
    context.font = '26px "Microsoft YaHei UI", sans-serif';
    wrapText(context, line, x + 74, lineY, 610, 34, 2);
  });
}

function drawPetAvatar(context: CanvasRenderingContext2D, x: number, y: number, state: PetState): void {
  const color = state === 'error' ? '#ef4444' : state === 'success' ? '#22c55e' : state === 'waiting' ? '#f59e0b' : '#2563eb';
  context.fillStyle = color;
  roundRect(context, x, y, 120, 120, 28);
  context.fill();
  context.fillStyle = '#ffffff';
  context.fillRect(x + 32, y + 40, 16, 16);
  context.fillRect(x + 72, y + 40, 16, 16);
  context.fillRect(x + 40, y + 78, 40, 10);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  const chars = Array.from(text);
  let line = '';
  let lineCount = 0;

  for (const char of chars) {
    const nextLine = line + char;

    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, y + lineCount * lineHeight);
      line = char;
      lineCount += 1;

      if (lineCount >= maxLines) {
        return;
      }
    } else {
      line = nextLine;
    }
  }

  if (lineCount < maxLines) {
    context.fillText(line, x, y + lineCount * lineHeight);
  }
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

const agentLabels: Record<AgentKind, string> = {
  'claude-code': 'Claude',
  codex: 'Codex',
  trae: 'Trae',
  openclaw: 'OpenClaw',
  terminal: 'Terminal'
};

const agentStatusLabels: Record<AgentStatus, string> = {
  started: '已开始',
  running: '进行中',
  waiting_permission: '等你确认',
  completed: '完成',
  failed: '失败',
  idle_too_long: '太久没动'
};

const memoryKindLabels: Record<MemoryKind, string> = {
  profile: '资料',
  preference: '偏好',
  project: '项目',
  fact: '事实',
  note: '笔记'
};

function formatTodoTime(todo: Todo): string {
  if (todo.status === 'completed') {
    return '已完成';
  }

  if (!todo.remindAt) {
    return '不提醒';
  }

  return new Date(todo.remindAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
