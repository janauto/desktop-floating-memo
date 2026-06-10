/**
 * 主浮窗：无边框、透明、置顶、毛玻璃。
 * 修复 v1 问题：blurOpacity 设置生效（v1 写死 0.55）；移除无效的 mouse-enter 事件；
 * 折叠/展开记忆展开高度。
 */
import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { WINDOW } from '@shared/constants'
import { getSettings, type AppStore } from '../settingsStore'

export class MainWindowManager {
  private window: BrowserWindow | null = null
  private collapsed = false
  private expandedHeight: number = WINDOW.EXPANDED_HEIGHT

  constructor(private readonly store: AppStore) {}

  get current(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  get isCollapsed(): boolean {
    return this.collapsed
  }

  create(): BrowserWindow {
    const bounds = this.store.get('windowBounds')
    const settings = getSettings(this.store)
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

    this.expandedHeight = bounds.height || WINDOW.EXPANDED_HEIGHT

    const win = new BrowserWindow({
      width: bounds.width || WINDOW.DEFAULT_WIDTH,
      height: this.expandedHeight,
      x: bounds.x ?? screenWidth - WINDOW.DEFAULT_WIDTH - 20,
      y: bounds.y ?? 60,
      frame: false,
      transparent: true,
      alwaysOnTop: settings.alwaysOnTop,
      resizable: true,
      skipTaskbar: true,
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
      win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/index.html')
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // 外部链接一律交给系统浏览器，不在应用内打开
    win.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    win.on('moved', () => {
      const [x, y] = win.getPosition()
      this.store.set('windowBounds.x', x)
      this.store.set('windowBounds.y', y)
    })

    win.on('blur', () => {
      if (!this.collapsed) {
        win.setOpacity(getSettings(this.store).blurOpacity)
      }
    })

    win.on('focus', () => {
      win.setOpacity(1.0)
    })

    win.on('closed', () => {
      this.window = null
    })

    this.window = win
    return win
  }

  show(): void {
    const win = this.current
    if (!win) return
    win.show()
    win.setOpacity(1.0)
  }

  toggleVisibility(): void {
    const win = this.current
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      this.show()
    }
  }

  setAlwaysOnTop(value: boolean): void {
    this.current?.setAlwaysOnTop(value)
  }

  toggleCollapse(state?: boolean): boolean {
    const win = this.current
    if (!win) return this.collapsed

    const next = state ?? !this.collapsed
    if (next === this.collapsed) return this.collapsed

    const [width, height] = win.getSize()
    if (next) {
      // 折叠前记住当前展开高度
      this.expandedHeight = height
      win.setSize(width, WINDOW.COLLAPSED_HEIGHT)
    } else {
      win.setSize(width, this.expandedHeight)
    }
    this.collapsed = next
    return this.collapsed
  }

  /** 渲染层按内容自适应高度 */
  resizeToContent(height: number): void {
    const win = this.current
    if (!win || this.collapsed) return
    const clamped = Math.max(WINDOW.MIN_CONTENT_HEIGHT, Math.floor(height))
    const [width] = win.getSize()
    win.setSize(width, clamped, true)
    this.expandedHeight = clamped
    this.store.set('windowBounds.width', width)
    this.store.set('windowBounds.height', clamped)
  }
}
