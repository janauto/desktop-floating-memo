/**
 * 主进程入口：组装各模块，管理应用生命周期。
 */
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initLogger, log } from './logger'
import { createStore } from './settingsStore'
import { openDatabase } from './db/connection'
import { TaskRepository } from './db/taskRepository'
import { StatsRepository } from './db/statsRepository'
import { migrateLegacyStoreTasks } from './db/migrateLegacyStore'
import { MainWindowManager } from './windows/mainWindow'
import { SettingsWindowManager } from './windows/settingsWindow'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc/register'
import type Database from 'better-sqlite3'

// 单实例锁：避免双开导致数据库写冲突
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  initLogger()
  log.info(`[app] starting floating-memo v${app.getVersion()}`)

  const store = createStore()
  let db: Database.Database | null = null
  let isQuitting = false

  const mainWindow = new MainWindowManager(store)
  const settingsWindow = new SettingsWindowManager()

  app.on('second-instance', () => {
    mainWindow.show()
  })

  app
    .whenReady()
    .then(() => {
      const dbPath = join(app.getPath('userData'), 'memo_history.db')
      db = openDatabase(dbPath, log)

      const tasks = new TaskRepository(db)
      const stats = new StatsRepository(db)

      // 旧版 electron-store 任务数据一次性迁入 SQLite
      migrateLegacyStoreTasks(store, tasks, log)

      registerIpcHandlers({ tasks, stats, store, mainWindow, settingsWindow })

      mainWindow.create()
      createTray(mainWindow, store, () => {
        isQuitting = true
        app.quit()
      })

      log.info('[app] ready')
    })
    .catch((err) => {
      log.error('[app] failed to start', err)
      app.quit()
    })

  app.on('window-all-closed', () => {
    // macOS 常驻托盘，不随窗口关闭退出
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow.create()
    } else {
      mainWindow.show()
    }
  })

  app.on('before-quit', () => {
    isQuitting = true
    try {
      db?.close()
      db = null
    } catch (err) {
      log.error('[app] error closing database', err)
    }
    log.info(`[app] quitting (isQuitting=${isQuitting})`)
  })
}
