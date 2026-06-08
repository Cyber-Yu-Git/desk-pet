import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { app, BrowserWindow, ipcMain, Notification, safeStorage, session, shell } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { createPetWindow, showPetContextMenu } from './windows/createPetWindow';
import { createTray } from './tray';
import { AgentEventIngestServer, type IncomingAgentHookEvent } from './agent/agentEventIngestServer';
import { AgentHookInstaller } from './agent/agentHookInstaller';
import { AgentIntegrationStore } from './agent/agentIntegrationStore';
import { agentRegistry } from './agent/agentRegistry';
import { claudeAdapter } from './agent/adapters/claudeAdapter';
import { openclawAdapter } from './agent/adapters/openclawAdapter';
import { opencodeAdapter } from './agent/adapters/opencodeAdapter';
import { hermesAdapter } from './agent/adapters/hermesAdapter';
import { AgentTaskStore } from './agent/agentTaskStore';
import {
  validateAgentTaskCreateInput,
  validateAgentTaskId,
  validateAgentTaskUpdateStatusInput
} from './agent/validateAgentTaskInput';
import { ChatHistoryStore } from './chat/chatHistoryStore';
import { requestDeepSeekReply } from './chat/deepSeekClient';
import { validateChatInput } from './chat/validateChatInput';
import { getPngBufferFromDataUrl, validateShareGenerateInput } from './share/validateShareInput';
import { MemoryStore } from './memory/memoryStore';
import { validateMemoryCreateInput, validateMemoryId } from './memory/validateMemoryInput';
import { SettingsStore } from './settings/settingsStore';
import { TodoStore } from './todo/todoStore';
import { validateTodoCreateInput, validateTodoId, validateTodoSnoozeInput } from './todo/validateTodoInput';
import { EventNames } from '../shared/eventNames';
import { IpcChannels } from '../shared/ipcChannels';
import { defaultNotificationConfig, defaultPetConfig } from '../shared/defaults';
import type { AgentStatus, ChatMessage, PetState } from '../shared/types';

let petWindow: BrowserWindow | null = null;
let agentIntegrationStore: AgentIntegrationStore;
let agentTaskStore: AgentTaskStore;
let chatHistoryStore: ChatHistoryStore;
let memoryStore: MemoryStore;
let settingsStore: SettingsStore;
let todoStore: TodoStore;
let reminderTimer: NodeJS.Timeout | undefined;
let agentEventIngestServer: AgentEventIngestServer;

function registerSecurityHandlers(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'notifications');
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.AppGetVersion, () => app.getVersion());
  ipcMain.handle(IpcChannels.AppMoveWindow, (_event, input: unknown) => {
    if (!petWindow) return { ok: false, error: { code: 'STORAGE_READ_FAILED', message: '没有窗口', recoverable: true } };
    if (!isRecord(input) || typeof input.dx !== 'number' || typeof input.dy !== 'number') return { ok: false, error: { code: 'IPC_INVALID_PAYLOAD', message: '无效参数', recoverable: true } };
    const [x, y] = petWindow.getPosition();
    petWindow.setPosition(x + Math.round(input.dx), y + Math.round(input.dy));
    return { ok: true };
  });
  ipcMain.handle(IpcChannels.AppShowContextMenu, () => {
    if (petWindow) {
      showPetContextMenu(petWindow);
    }

    return { ok: true };
  });
  ipcMain.handle(IpcChannels.SettingsGetPetConfig, () => defaultPetConfig);
  ipcMain.handle(IpcChannels.SettingsGetNotificationConfig, () => defaultNotificationConfig);
  ipcMain.handle(IpcChannels.SettingsGetDeepSeekConfig, () => ({
    ok: true,
    data: settingsStore.getDeepSeekConfig()
  }));
  ipcMain.handle(IpcChannels.SettingsUpdateDeepSeekConfig, (_event, input: unknown) =>
    settingsStore.updateDeepSeekConfig(input)
  );
  ipcMain.handle(IpcChannels.SettingsGetDataLocation, () => ({
    ok: true,
    data: getDataLocationInfo()
  }));
  ipcMain.handle(IpcChannels.SettingsOpenDataLocation, async () => {
    const errorMessage = await shell.openPath(app.getPath('userData'));

    if (errorMessage) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_READ_FAILED',
          message: errorMessage,
          recoverable: true
        }
      };
    }

    return {
      ok: true,
      data: getDataLocationInfo()
    };
  });
  ipcMain.handle(IpcChannels.SettingsClearChatHistory, () => {
    chatHistoryStore.clear();
    return {
      ok: true,
      data: chatHistoryStore.list()
    };
  });
  ipcMain.handle(IpcChannels.SettingsClearMemories, () => {
    memoryStore.clear();
    return {
      ok: true,
      data: memoryStore.list()
    };
  });
  ipcMain.handle(IpcChannels.ChatGetHistory, () => ({
    ok: true,
    data: chatHistoryStore.list()
  }));
  ipcMain.handle(IpcChannels.ChatSendMessage, async (_event, input: unknown) => {
    const validated = validateChatInput(input);

    if (!validated.ok) {
      return validated;
    }

    const userMessage = createChatMessage('user', validated.data.content);
    const historyWithUser = chatHistoryStore.append([userMessage]);
    const promptMemories = memoryStore.listForPrompt();

    emitPetState('working', 'chat-send-message');
    const reply = await requestDeepSeekReply(historyWithUser, {
      apiKey: settingsStore.getDeepSeekApiKey(),
      model: settingsStore.getDeepSeekModel(),
      memories: promptMemories
    });

    if (!reply.ok) {
      emitPetState('error', 'chat-send-message-failed');
      return reply;
    }

    const assistantMessage = createChatMessage('assistant', reply.data);
    const messages = chatHistoryStore.append([assistantMessage]);
    memoryStore.markUsed(promptMemories.map((memory) => memory.id));
    emitPetState('success', 'chat-send-message-completed');

    return {
      ok: true,
      data: {
        userMessage,
        assistantMessage,
        messages
      }
    };
  });
  ipcMain.handle(IpcChannels.TodoList, () => ({
    ok: true,
    data: todoStore.list()
  }));
  ipcMain.handle(IpcChannels.TodoCreate, (_event, input: unknown) => {
    const validated = validateTodoCreateInput(input);

    if (!validated.ok) {
      return validated;
    }

    const todo = todoStore.create(validated.data);
    emitPetState('success', 'todo-created');
    checkDueReminders();

    return {
      ok: true,
      data: todo
    };
  });
  ipcMain.handle(IpcChannels.TodoComplete, (_event, input: unknown) => {
    const validated = validateTodoId(input);

    if (!validated.ok) {
      return validated;
    }

    todoStore.complete(validated.data);

    return {
      ok: true,
      data: todoStore.list()
    };
  });
  ipcMain.handle(IpcChannels.TodoDelete, (_event, input: unknown) => {
    const validated = validateTodoId(input);

    if (!validated.ok) {
      return validated;
    }

    todoStore.delete(validated.data);

    return {
      ok: true,
      data: todoStore.list()
    };
  });
  ipcMain.handle(IpcChannels.ReminderList, () => ({
    ok: true,
    data: todoStore.listActiveReminders()
  }));
  ipcMain.handle(IpcChannels.ReminderSnooze, (_event, input: unknown) => {
    const validated = validateTodoSnoozeInput(input);

    if (!validated.ok) {
      return validated;
    }

    const todo = todoStore.snooze(validated.data.id, validated.data.minutes);

    return {
      ok: true,
      data: todo ?? null
    };
  });
  ipcMain.handle(IpcChannels.AgentGetStatus, () => ({
    ok: true,
    data: agentTaskStore.list()
  }));
  ipcMain.handle(IpcChannels.AgentGetHistory, () => ({
    ok: true,
    data: agentTaskStore.list()
  }));
  ipcMain.handle(IpcChannels.AgentHookDiscover, () => ({
    ok: true,
    data: agentRegistry.discoverAll()
  }));
  ipcMain.handle(IpcChannels.AgentHookGetStatus, () => ({
    ok: true,
    data: createAgentHookInstaller().getStatus()
  }));
  ipcMain.handle(IpcChannels.AgentHookInstallClaude, (_event, input: unknown) => {
    try {
      const { settingsPath, scope, scopePath } = parseHookTarget(input);
      return {
        ok: true,
        data: createAgentHookInstaller().installClaudeHook(settingsPath, scope, scopePath)
      };
    } catch (error) {
      return agentHookError(error);
    }
  });
  ipcMain.handle(IpcChannels.AgentHookRemoveClaude, (_event, input: unknown) => {
    try {
      const { settingsPath, scope, scopePath } = parseHookTarget(input);
      return {
        ok: true,
        data: createAgentHookInstaller().removeClaudeHook(settingsPath, scope, scopePath)
      };
    } catch (error) {
      return agentHookError(error);
    }
  });
  ipcMain.handle(IpcChannels.AgentHookInstallClaudeProject, (_event, input: unknown) => {
    try {
      const projectPath = validateProjectPath(input);
      const installer = createAgentHookInstaller();
      installer.installClaudeProjectHook(projectPath);
      return {
        ok: true,
        data: installer.getStatus()
      };
    } catch (error) {
      return agentHookError(error);
    }
  });
  ipcMain.handle(IpcChannels.AgentHookRemoveClaudeProject, (_event, input: unknown) => {
    try {
      const projectPath = validateProjectPath(input);
      const installer = createAgentHookInstaller();
      installer.removeClaudeProjectHook(projectPath);
      return {
        ok: true,
        data: installer.getStatus()
      };
    } catch (error) {
      return agentHookError(error);
    }
  });
  ipcMain.handle(IpcChannels.AgentTaskCreate, (_event, input: unknown) => {
    const validated = validateAgentTaskCreateInput(input);

    if (!validated.ok) {
      return validated;
    }

    const task = agentTaskStore.create(validated.data);
    emitPetState('working', 'agent-task-created');

    return {
      ok: true,
      data: task
    };
  });
  ipcMain.handle(IpcChannels.AgentTaskUpdateStatus, (_event, input: unknown) => {
    const validated = validateAgentTaskUpdateStatusInput(input);

    if (!validated.ok) {
      return validated;
    }

    const task = agentTaskStore.updateStatus(validated.data);

    if (task) {
      emitPetState(mapAgentStatusToPetState(task.status), 'agent-task-status-updated');
    }

    return {
      ok: true,
      data: task ?? null
    };
  });
  ipcMain.handle(IpcChannels.AgentTaskDelete, (_event, input: unknown) => {
    const validated = validateAgentTaskId(input);

    if (!validated.ok) {
      return validated;
    }

    return {
      ok: true,
      data: agentTaskStore.delete(validated.data)
    };
  });
  ipcMain.handle(IpcChannels.MemoryList, () => ({
    ok: true,
    data: memoryStore.list()
  }));
  ipcMain.handle(IpcChannels.MemoryCreate, (_event, input: unknown) => {
    const validated = validateMemoryCreateInput(input);

    if (!validated.ok) {
      return validated;
    }

    const memory = memoryStore.create(validated.data);
    emitPetState('success', 'memory-created');

    return {
      ok: true,
      data: memory
    };
  });
  ipcMain.handle(IpcChannels.MemoryDelete, (_event, input: unknown) => {
    const validated = validateMemoryId(input);

    if (!validated.ok) {
      return validated;
    }

    return {
      ok: true,
      data: memoryStore.delete(validated.data)
    };
  });
  ipcMain.handle(IpcChannels.ShareGenerate, (_event, input: unknown) => {
    const validated = validateShareGenerateInput(input);

    if (!validated.ok) {
      return validated;
    }

    const shareDir = join(app.getPath('pictures'), '赛博宇桌宠分享图');
    const fileName = validated.data.fileName ?? `cyber-yu-share-${formatTimestampForFileName(new Date())}.png`;
    const filePath = join(shareDir, fileName.endsWith('.png') ? fileName : `${fileName}.png`);

    mkdirSync(shareDir, { recursive: true });
    writeFileSync(filePath, getPngBufferFromDataUrl(validated.data.dataUrl));
    emitPetState('sharing', 'share-image-generated');

    return {
      ok: true,
      data: {
        filePath
      }
    };
  });
  ipcMain.handle(IpcChannels.AppQuit, () => {
    app.quit();
    return { ok: true };
  });
}

function createChatMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function emitPetState(state: PetState, reason: string, priority: 'low' | 'normal' | 'high' = 'normal'): void {
  petWindow?.webContents.send('pet:event', {
    type: EventNames.PetStateChange,
    state,
    reason,
    priority,
    createdAt: new Date().toISOString()
  });
}

function mapAgentStatusToPetState(status: AgentStatus): PetState {
  switch (status) {
    case 'started':
    case 'running':
      return 'working';
    case 'waiting_permission':
    case 'idle_too_long':
      return 'waiting';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
  }
}

function handleAgentHookEvent(event: IncomingAgentHookEvent): void {
  const adapter = agentRegistry.get(event.agent);
  if (!adapter) return;

  const normalized = adapter.normalize(event.raw);
  const integration = event.integrationId ? agentIntegrationStore.findById(event.integrationId) : undefined;
  const scope = integration?.scope ?? event.scope ?? 'windows-user';
  const integrationId = integration?.id ?? event.integrationId ?? `external:${event.agent}:${scope}`;

  if (integration) {
    agentIntegrationStore.markEventReceived(integration.id, event.receivedAt);
  }

  const task = agentTaskStore.upsertWatcherTask({
    integrationId,
    agent: event.agent,
    scope,
    sessionId: normalized.sessionId,
    title: normalized.title,
    status: normalized.status,
    message: normalized.message,
    projectPath: normalized.projectPath
  });
  emitPetState(mapAgentStatusToPetState(task.status), `agent-hook:${task.agent}:${task.status}`, normalized.priority);

  if (
    (task.status === 'completed' || task.status === 'failed' || task.status === 'waiting_permission') &&
    defaultNotificationConfig.enabled &&
    Notification.isSupported()
  ) {
    new Notification({
      title: `Claude Code ${getAgentNotificationTitle(task.status)}`,
      body: task.title,
      silent: !defaultNotificationConfig.soundEnabled
    }).show();
  }
}

function getAgentNotificationTitle(status: AgentStatus): string {
  switch (status) {
    case 'completed':
      return '完成了';
    case 'failed':
      return '失败了';
    case 'waiting_permission':
      return '在等你确认';
    default:
      return '状态更新';
  }
}

function createAgentHookInstaller(): AgentHookInstaller {
  return new AgentHookInstaller({
    userDataPath: app.getPath('userData'),
    endpoint: agentEventIngestServer.endpoint,
    token: agentEventIngestServer.authToken,
    serverRunning: agentEventIngestServer.isRunning,
    integrationStore: agentIntegrationStore,
    lastEventAt: agentEventIngestServer.lastReceivedAt
  });
}

function agentHookError(error: unknown) {
  return {
    ok: false,
    error: {
      code: 'AGENT_SOURCE_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Claude Code Hook 操作失败。',
      recoverable: true
    }
  };
}

function parseHookTarget(input: unknown): { settingsPath?: string; scope?: string; scopePath?: string } {
  if (!isRecord(input)) return {};
  return {
    settingsPath: typeof input.settingsPath === 'string' ? input.settingsPath : undefined,
    scope: typeof input.scope === 'string' ? input.scope : undefined,
    scopePath: typeof input.scopePath === 'string' ? input.scopePath : undefined
  };
}

function validateProjectPath(input: unknown): string {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('projectPath' in input) ||
    typeof input.projectPath !== 'string' ||
    input.projectPath.trim().length === 0
  ) {
    throw new Error('项目路径无效。');
  }

  return resolve(input.projectPath);
}

function formatTimestampForFileName(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function getDataLocationInfo() {
  return {
    userDataPath: app.getPath('userData'),
    shareImagePath: join(app.getPath('pictures'), '赛博宇桌宠分享图')
  };
}

function startReminderTimer(): void {
  reminderTimer = setInterval(checkDueReminders, 30000);
}

function checkDueReminders(): void {
  const dueReminders = todoStore.findDueReminders();

  for (const todo of dueReminders) {
    todoStore.markReminded(todo.id);
    emitPetState('reminding', 'todo-reminder-due', 'high');

    if (defaultNotificationConfig.enabled && Notification.isSupported()) {
      new Notification({
        title: '赛博宇提醒你',
        body: todo.title,
        silent: !defaultNotificationConfig.soundEnabled
      }).show();
    }
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.cyberyu.deskpet');
  agentRegistry.register(claudeAdapter);
  agentRegistry.register(openclawAdapter);
  agentRegistry.register(opencodeAdapter);
  agentRegistry.register(hermesAdapter);
  agentIntegrationStore = new AgentIntegrationStore(join(app.getPath('userData'), 'desk-pet-agent-integrations.json'));
  agentTaskStore = new AgentTaskStore(join(app.getPath('userData'), 'desk-pet-agent-tasks.json'));
  chatHistoryStore = new ChatHistoryStore(join(app.getPath('userData'), 'desk-pet-data.json'));
  memoryStore = new MemoryStore(join(app.getPath('userData'), 'desk-pet-memories.json'));
  settingsStore = new SettingsStore(join(app.getPath('userData'), 'desk-pet-settings.json'), safeStorage);
  todoStore = new TodoStore(join(app.getPath('userData'), 'desk-pet-todos.json'));
  agentEventIngestServer = new AgentEventIngestServer({
    secretPath: join(app.getPath('userData'), 'desk-pet-agent-hook-secret.json'),
    onEvent: handleAgentHookEvent
  });
  await agentEventIngestServer.start();
  writeFileSync(join(app.getPath('userData'), 'desk-pet-agent-endpoint.txt'), agentEventIngestServer.endpoint, 'utf8');
  createAgentHookInstaller().getStatus();
  registerSecurityHandlers();
  registerIpcHandlers();

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  petWindow = createPetWindow();
  createTray(petWindow);
  startReminderTimer();
  checkDueReminders();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    petWindow = createPetWindow();
    createTray(petWindow);
  }
});

app.on('before-quit', () => {
  if (reminderTimer) {
    clearInterval(reminderTimer);
  }

  agentEventIngestServer?.stop();
});
