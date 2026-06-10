/**
 * IPC 注册中心：所有通道集中在此，入参一律经 validate 校验。
 */
import { ipcMain } from 'electron'
import { IPC } from '@shared/constants'
import {
  sanitizeGameState,
  sanitizeSettings,
  validateId,
  validateIdList,
  validateNewTask,
  validateXp
} from '@shared/validate'
import { log } from '../logger'
import type { TaskRepository } from '../db/taskRepository'
import type { StatsRepository } from '../db/statsRepository'
import { getGameState, getSettings, type AppStore } from '../settingsStore'
import type { MainWindowManager } from '../windows/mainWindow'
import type { SettingsWindowManager } from '../windows/settingsWindow'

export interface IpcDeps {
  tasks: TaskRepository
  stats: StatsRepository
  store: AppStore
  mainWindow: MainWindowManager
  settingsWindow: SettingsWindowManager
}

export function registerIpcHandlers(deps: IpcDeps): void {
  const { tasks, stats, store, mainWindow, settingsWindow } = deps

  // ---- 任务（SQLite 唯一真相源） ----
  ipcMain.handle(IPC.TASKS_LIST, () => tasks.listActive())

  ipcMain.handle(IPC.TASKS_ADD, (_e, input: unknown) => tasks.add(validateNewTask(input)))

  ipcMain.handle(IPC.TASKS_COMPLETE, (_e, id: unknown, xpEarned: unknown) =>
    tasks.complete(validateId(id), validateXp(xpEarned))
  )

  ipcMain.handle(IPC.TASKS_DELETE, (_e, id: unknown) => tasks.softDelete(validateId(id)))

  ipcMain.handle(IPC.TASKS_TOGGLE_TIMER, (_e, id: unknown) => tasks.toggleTimer(validateId(id)))

  ipcMain.handle(IPC.TASKS_REORDER, (_e, ids: unknown) => tasks.reorder(validateIdList(ids)))

  // ---- 游戏状态 ----
  ipcMain.handle(IPC.GAME_GET, () => getGameState(store))

  ipcMain.handle(IPC.GAME_SAVE, (_e, state: unknown) => {
    store.set('gameState', sanitizeGameState(state, getGameState(store)))
    return true
  })

  // ---- 设置 ----
  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings(store))

  ipcMain.handle(IPC.SETTINGS_SAVE, (_e, input: unknown) => {
    const settings = sanitizeSettings(input)
    store.set('settings', settings)
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop)
    mainWindow.current?.webContents.send(IPC.SETTINGS_UPDATED, settings)
    return true
  })

  // ---- 窗口 ----
  ipcMain.handle(IPC.WINDOW_TOGGLE_COLLAPSE, (_e, state: unknown) =>
    mainWindow.toggleCollapse(typeof state === 'boolean' ? state : undefined)
  )

  ipcMain.handle(IPC.WINDOW_RESIZE, (_e, height: unknown) => {
    if (typeof height === 'number' && Number.isFinite(height)) {
      mainWindow.resizeToContent(height)
    }
  })

  ipcMain.handle(IPC.SETTINGS_WINDOW_OPEN, () => settingsWindow.open())
  ipcMain.handle(IPC.SETTINGS_WINDOW_CLOSE, () => settingsWindow.close())
  ipcMain.handle(IPC.SETTINGS_WINDOW_FULLSCREEN, () => settingsWindow.toggleFullscreen())

  // ---- 统计 ----
  ipcMain.handle(IPC.STATS_GET, () => stats.getStats())

  ipcMain.handle(IPC.HISTORY_GET, (_e, limit: unknown, offset: unknown) =>
    tasks.history(
      typeof limit === 'number' ? limit : 200,
      typeof offset === 'number' ? offset : 0
    )
  )

  // ---- 渲染进程错误上报 ----
  ipcMain.on(IPC.LOG_ERROR, (_e, message: unknown) => {
    if (typeof message === 'string') {
      log.error('[renderer]', message.slice(0, 2000))
    }
  })
}
