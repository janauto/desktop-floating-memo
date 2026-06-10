/**
 * 设置 / 控制中心窗口（单例）。
 */
import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

export class SettingsWindowManager {
  private window: BrowserWindow | null = null

  get current(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  open(): void {
    const existing = this.current
    if (existing) {
      existing.focus()
      return
    }

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    const win = new BrowserWindow({
      width: Math.min(900, screenWidth - 100),
      height: Math.min(650, screenHeight - 100),
      center: true,
      frame: false,
      transparent: true,
      hasShadow: true,
      vibrancy: 'under-window',
      visualEffectState: 'active',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/settings.html')
    } else {
      win.loadFile(join(__dirname, '../renderer/settings.html'))
    }

    win.setAlwaysOnTop(false)
    win.on('closed', () => {
      this.window = null
    })

    this.window = win
  }

  close(): void {
    this.current?.close()
  }

  toggleFullscreen(): boolean {
    const win = this.current
    if (!win) return false
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    return next
  }
}
