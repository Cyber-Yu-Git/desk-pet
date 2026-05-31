import { BrowserWindow, Menu, Tray, app, nativeImage } from 'electron';

const trayIconDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANUlEQVR42mNgGAXDADDC/5+BgeE/VMNQBRgYGBg+MDAw/McABjA0NDT8R8MwCkbBDAwAAGcMBxVsYjCiAAAAAElFTkSuQmCC';

let tray: Tray | null = null;

export function createTray(petWindow: BrowserWindow): Tray {
  const icon = nativeImage.createFromDataURL(trayIconDataUrl);
  tray = new Tray(icon);
  tray.setToolTip('赛博宇的桌面AI宠物');
  tray.setContextMenu(createTrayMenu(petWindow));

  tray.on('click', () => {
    if (petWindow.isVisible()) {
      petWindow.hide();
    } else {
      petWindow.show();
    }
  });

  return tray;
}

function createTrayMenu(petWindow: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        if (petWindow.isVisible()) {
          petWindow.hide();
        } else {
          petWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit()
    }
  ]);
}
