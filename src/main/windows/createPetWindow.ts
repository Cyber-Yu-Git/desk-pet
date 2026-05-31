import { join } from 'node:path';
import { BrowserWindow, Menu, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { EventNames } from '../../shared/eventNames';
import type { PetState } from '../../shared/types';

export function createPetWindow(): BrowserWindow {
  const petWindow = new BrowserWindow({
    width: 360,
    height: 620,
    minWidth: 260,
    minHeight: 520,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  petWindow.setMenu(null);

  petWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  petWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  petWindow.webContents.on('context-menu', () => {
    createPetContextMenu(petWindow).popup({ window: petWindow });
  });

  petWindow.once('ready-to-show', () => {
    petWindow.show();
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void petWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void petWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return petWindow;
}

function createPetContextMenu(petWindow: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: '聊天',
      click: () => emitPetState(petWindow, 'idle', 'context-menu-chat')
    },
    {
      label: '新增待办',
      click: () => emitPetState(petWindow, 'reminding', 'context-menu-todo')
    },
    {
      label: '帮我盯这个任务',
      click: () => emitPetState(petWindow, 'working', 'context-menu-watch')
    },
    {
      label: '生成分享图',
      click: () => emitPetState(petWindow, 'sharing', 'context-menu-share')
    },
    { type: 'separator' },
    {
      label: '勿扰模式',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        const next = menuItem.checked;
        emitPetState(petWindow, next ? 'sleeping' : 'idle', 'context-menu-dnd');
      }
    },
    {
      label: '设置',
      click: () => emitPetState(petWindow, 'idle', 'context-menu-settings')
    },
    { type: 'separator' },
    {
      label: '隐藏',
      click: () => petWindow.hide()
    },
    {
      label: '退出',
      click: () => petWindow.webContents.send('app:request-quit')
    }
  ]);
}

function emitPetState(petWindow: BrowserWindow, state: PetState, reason: string): void {
  petWindow.webContents.send('pet:event', {
    type: EventNames.PetStateChange,
    state,
    reason,
    priority: 'normal',
    createdAt: new Date().toISOString()
  });
}
