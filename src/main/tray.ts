/**
 * 系统托盘：显示/隐藏、置顶开关（与设置联动）、退出。
 */
import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'path'
import { log } from './logger'
import { getSettings, type AppStore } from './settingsStore'
import type { MainWindowManager } from './windows/mainWindow'

export function createTray(
  mainWindow: MainWindowManager,
  store: AppStore,
  onQuit: () => void
): Tray {
  let trayIcon = nativeImage.createEmpty()
  try {
    // app.getAppPath() 在开发态指向项目根目录，打包后指向 app.asar（fs 可透明读取）
    const iconPath = join(app.getAppPath(), 'resources', 'tray-icon.png')
    const loaded = nativeImage.createFromPath(iconPath)
    if (!loaded.isEmpty()) {
      trayIcon = loaded.resize({ width: 16, height: 16 })
      trayIcon.setTemplateImage(true)
    }
  } catch (err) {
    log.warn('[tray] failed to load icon, using empty image', err)
  }

  const tray = new Tray(trayIcon)
  tray.setToolTip('浮窗备忘录')

  const buildMenu = () =>
    Menu.buildFromTemplate([
      {
        label: '显示/隐藏',
        click: () => mainWindow.toggleVisibility()
      },
      {
        label: '始终置顶',
        type: 'checkbox',
        checked: getSettings(store).alwaysOnTop,
        click: (menuItem) => {
          mainWindow.setAlwaysOnTop(menuItem.checked)
          store.set('settings.alwaysOnTop', menuItem.checked)
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: onQuit
      }
    ])

  tray.setContextMenu(buildMenu())

  tray.on('click', () => {
    const win = mainWindow.current
    if (win?.isVisible()) {
      win.focus()
    } else {
      mainWindow.show()
    }
  })

  return tray
}
