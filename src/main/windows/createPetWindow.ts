import { join } from 'node:path';
import { BrowserWindow, Menu, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { EventNames } from '../../shared/eventNames';
import type { AppPanel, PetState } from '../../shared/types';

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

  petWindow.webContents.on('context-menu', () => showPetContextMenu(petWindow));

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

export function showPetContextMenu(petWindow: BrowserWindow): void {
  createPetContextMenu(petWindow).popup({ window: petWindow });
}

function createPetContextMenu(petWindow: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: '聊天',
      click: () => openPanel(petWindow, 'chat')
    },
    {
      label: '待办 / 提醒',
      click: () => openPanel(petWindow, 'todo')
    },
    {
      label: 'Agent 监听',
      click: () => openPanel(petWindow, 'agent')
    },
    {
      label: '记忆',
      click: () => openPanel(petWindow, 'memory')
    },
    {
      label: '生成分享图',
      click: () => openPanel(petWindow, 'share')
    },
    { type: 'separator' },
    {
      label: '待机',
      click: () => emitPetState(petWindow, 'idle', 'context-menu-idle')
    },
    {
      label: '工作中',
      click: () => emitPetState(petWindow, 'working', 'context-menu-working')
    },
    {
      label: '完成',
      click: () => emitPetState(petWindow, 'success', 'context-menu-success')
    },
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
      click: () => openPanel(petWindow, 'settings')
    },
    { type: 'separator' },
    {
      label: '收起面板',
      click: () => petWindow.webContents.send('app:collapse-panel')
    },
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

function openPanel(petWindow: BrowserWindow, panel: AppPanel): void {
  petWindow.webContents.send('app:open-panel', panel);
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
