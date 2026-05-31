import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { createPetWindow } from './windows/createPetWindow';
import { createTray } from './tray';
import { ChatHistoryStore } from './chat/chatHistoryStore';
import { requestDeepSeekReply } from './chat/deepSeekClient';
import { validateChatInput } from './chat/validateChatInput';
import { EventNames } from '../shared/eventNames';
import { IpcChannels } from '../shared/ipcChannels';
import { defaultNotificationConfig, defaultPetConfig } from '../shared/defaults';
import type { ChatMessage, PetState } from '../shared/types';

let petWindow: BrowserWindow | null = null;
let chatHistoryStore: ChatHistoryStore;

function registerSecurityHandlers(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'notifications');
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.AppGetVersion, () => app.getVersion());
  ipcMain.handle(IpcChannels.SettingsGetPetConfig, () => defaultPetConfig);
  ipcMain.handle(IpcChannels.SettingsGetNotificationConfig, () => defaultNotificationConfig);
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

    emitPetState('working', 'chat-send-message');
    const reply = await requestDeepSeekReply(historyWithUser);

    if (!reply.ok) {
      emitPetState('error', 'chat-send-message-failed');
      return reply;
    }

    const assistantMessage = createChatMessage('assistant', reply.data);
    const messages = chatHistoryStore.append([assistantMessage]);
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

function emitPetState(state: PetState, reason: string): void {
  petWindow?.webContents.send('pet:event', {
    type: EventNames.PetStateChange,
    state,
    reason,
    priority: 'normal',
    createdAt: new Date().toISOString()
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cyberyu.deskpet');
  chatHistoryStore = new ChatHistoryStore(join(app.getPath('userData'), 'desk-pet-data.json'));
  registerSecurityHandlers();
  registerIpcHandlers();

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  petWindow = createPetWindow();
  createTray(petWindow);
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
