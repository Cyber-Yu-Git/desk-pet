import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipcChannels';
import type {
  AppResult,
  AppPanel,
  AgentHookStatus,
  AgentTask,
  AgentTaskCreateInput,
  AgentTaskUpdateStatusInput,
  ChatMessage,
  ChatSendInput,
  ChatSendResult,
  DataLocationInfo,
  DeepSeekConfig,
  DeepSeekUpdateInput,
  MemoryCreateInput,
  MemoryItem,
  PetEvent,
  ShareGenerateInput,
  ShareGenerateResult,
  Todo,
  TodoCreateInput,
  TodoSnoozeInput
} from '../shared/types';

const deskPetApi = {
  app: {
    getVersion: () => ipcRenderer.invoke(IpcChannels.AppGetVersion) as Promise<string>,
    quit: () => ipcRenderer.invoke(IpcChannels.AppQuit) as Promise<{ ok: boolean }>,
    moveWindow: (dx: number, dy: number) => ipcRenderer.invoke(IpcChannels.AppMoveWindow, { dx, dy }),
    showContextMenu: () => ipcRenderer.invoke(IpcChannels.AppShowContextMenu) as Promise<{ ok: boolean }>
  },
  settings: {
    getPetConfig: () => ipcRenderer.invoke(IpcChannels.SettingsGetPetConfig),
    getNotificationConfig: () => ipcRenderer.invoke(IpcChannels.SettingsGetNotificationConfig),
    getDeepSeekConfig: () => ipcRenderer.invoke(IpcChannels.SettingsGetDeepSeekConfig) as Promise<AppResult<DeepSeekConfig>>,
    updateDeepSeekConfig: (input: DeepSeekUpdateInput) =>
      ipcRenderer.invoke(IpcChannels.SettingsUpdateDeepSeekConfig, input) as Promise<AppResult<DeepSeekConfig>>,
    getDataLocation: () => ipcRenderer.invoke(IpcChannels.SettingsGetDataLocation) as Promise<AppResult<DataLocationInfo>>,
    openDataLocation: () => ipcRenderer.invoke(IpcChannels.SettingsOpenDataLocation) as Promise<AppResult<DataLocationInfo>>,
    clearChatHistory: () => ipcRenderer.invoke(IpcChannels.SettingsClearChatHistory) as Promise<AppResult<ChatMessage[]>>,
    clearMemories: () => ipcRenderer.invoke(IpcChannels.SettingsClearMemories) as Promise<AppResult<MemoryItem[]>>
  },
  chat: {
    getHistory: () => ipcRenderer.invoke(IpcChannels.ChatGetHistory) as Promise<AppResult<ChatMessage[]>>,
    sendMessage: (input: ChatSendInput) =>
      ipcRenderer.invoke(IpcChannels.ChatSendMessage, input) as Promise<AppResult<ChatSendResult>>
  },
  todos: {
    list: () => ipcRenderer.invoke(IpcChannels.TodoList) as Promise<AppResult<Todo[]>>,
    create: (input: TodoCreateInput) => ipcRenderer.invoke(IpcChannels.TodoCreate, input) as Promise<AppResult<Todo>>,
    complete: (id: string) => ipcRenderer.invoke(IpcChannels.TodoComplete, { id }) as Promise<AppResult<Todo[]>>,
    delete: (id: string) => ipcRenderer.invoke(IpcChannels.TodoDelete, { id }) as Promise<AppResult<Todo[]>>,
    listReminders: () => ipcRenderer.invoke(IpcChannels.ReminderList) as Promise<AppResult<Todo[]>>,
    snoozeReminder: (input: TodoSnoozeInput) =>
      ipcRenderer.invoke(IpcChannels.ReminderSnooze, input) as Promise<AppResult<Todo | null>>
  },
  agents: {
    listTasks: () => ipcRenderer.invoke(IpcChannels.AgentGetStatus) as Promise<AppResult<AgentTask[]>>,
    discoverClaudeCode: () => ipcRenderer.invoke(IpcChannels.AgentHookDiscover),
    getHookStatus: () => ipcRenderer.invoke(IpcChannels.AgentHookGetStatus) as Promise<AppResult<AgentHookStatus>>,
    installClaudeHook: (target?: { settingsPath?: string; scope?: string; scopePath?: string }) =>
      ipcRenderer.invoke(IpcChannels.AgentHookInstallClaude, target ?? {}) as Promise<AppResult<AgentHookStatus>>,
    removeClaudeHook: (target?: { settingsPath?: string; scope?: string; scopePath?: string }) =>
      ipcRenderer.invoke(IpcChannels.AgentHookRemoveClaude, target ?? {}) as Promise<AppResult<AgentHookStatus>>,
    installClaudeProjectHook: (projectPath: string) =>
      ipcRenderer.invoke(IpcChannels.AgentHookInstallClaudeProject, { projectPath }) as Promise<AppResult<AgentHookStatus>>,
    removeClaudeProjectHook: (projectPath: string) =>
      ipcRenderer.invoke(IpcChannels.AgentHookRemoveClaudeProject, { projectPath }) as Promise<AppResult<AgentHookStatus>>,
    createTask: (input: AgentTaskCreateInput) =>
      ipcRenderer.invoke(IpcChannels.AgentTaskCreate, input) as Promise<AppResult<AgentTask>>,
    updateTaskStatus: (input: AgentTaskUpdateStatusInput) =>
      ipcRenderer.invoke(IpcChannels.AgentTaskUpdateStatus, input) as Promise<AppResult<AgentTask | null>>,
    deleteTask: (id: string) => ipcRenderer.invoke(IpcChannels.AgentTaskDelete, { id }) as Promise<AppResult<AgentTask[]>>
  },
  memory: {
    list: () => ipcRenderer.invoke(IpcChannels.MemoryList) as Promise<AppResult<MemoryItem[]>>,
    create: (input: MemoryCreateInput) => ipcRenderer.invoke(IpcChannels.MemoryCreate, input) as Promise<AppResult<MemoryItem>>,
    delete: (id: string) => ipcRenderer.invoke(IpcChannels.MemoryDelete, { id }) as Promise<AppResult<MemoryItem[]>>
  },
  share: {
    generate: (input: ShareGenerateInput) =>
      ipcRenderer.invoke(IpcChannels.ShareGenerate, input) as Promise<AppResult<ShareGenerateResult>>
  },
  events: {
    onPetEvent: (callback: (event: PetEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: PetEvent): void => callback(payload);
      ipcRenderer.on('pet:event', listener);
      return () => ipcRenderer.removeListener('pet:event', listener);
    },
    onQuitRequest: (callback: () => void) => {
      const listener = (): void => callback();
      ipcRenderer.on('app:request-quit', listener);
      return () => ipcRenderer.removeListener('app:request-quit', listener);
    },
    onOpenPanel: (callback: (panel: AppPanel) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, panel: AppPanel): void => callback(panel);
      ipcRenderer.on('app:open-panel', listener);
      return () => ipcRenderer.removeListener('app:open-panel', listener);
    },
    onCollapsePanel: (callback: () => void) => {
      const listener = (): void => callback();
      ipcRenderer.on('app:collapse-panel', listener);
      return () => ipcRenderer.removeListener('app:collapse-panel', listener);
    }
  }
};

contextBridge.exposeInMainWorld('deskPet', deskPetApi);

export type DeskPetApi = typeof deskPetApi;
