import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipcChannels';
import type { AppResult, ChatMessage, ChatSendInput, ChatSendResult, PetEvent } from '../shared/types';

const deskPetApi = {
  app: {
    getVersion: () => ipcRenderer.invoke(IpcChannels.AppGetVersion) as Promise<string>,
    quit: () => ipcRenderer.invoke(IpcChannels.AppQuit) as Promise<{ ok: boolean }>
  },
  settings: {
    getPetConfig: () => ipcRenderer.invoke(IpcChannels.SettingsGetPetConfig),
    getNotificationConfig: () => ipcRenderer.invoke(IpcChannels.SettingsGetNotificationConfig)
  },
  chat: {
    getHistory: () => ipcRenderer.invoke(IpcChannels.ChatGetHistory) as Promise<AppResult<ChatMessage[]>>,
    sendMessage: (input: ChatSendInput) =>
      ipcRenderer.invoke(IpcChannels.ChatSendMessage, input) as Promise<AppResult<ChatSendResult>>
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
    }
  }
};

contextBridge.exposeInMainWorld('deskPet', deskPetApi);

export type DeskPetApi = typeof deskPetApi;
