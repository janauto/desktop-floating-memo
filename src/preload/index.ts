/**
 * Preload：通过 contextBridge 暴露类型化、最小化的 API。
 * 渲染进程拿不到 ipcRenderer 本体，只能调用白名单方法。
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/constants'
import type { GameState, NewTaskInput, RendererApi, Settings } from '@shared/types'

const api: RendererApi = {
  // 任务
  listTasks: () => ipcRenderer.invoke(IPC.TASKS_LIST),
  addTask: (input: NewTaskInput) => ipcRenderer.invoke(IPC.TASKS_ADD, input),
  completeTask: (id: string, xpEarned: number) =>
    ipcRenderer.invoke(IPC.TASKS_COMPLETE, id, xpEarned),
  deleteTask: (id: string) => ipcRenderer.invoke(IPC.TASKS_DELETE, id),
  toggleTaskTimer: (id: string) => ipcRenderer.invoke(IPC.TASKS_TOGGLE_TIMER, id),
  reorderTasks: (orderedIds: string[]) => ipcRenderer.invoke(IPC.TASKS_REORDER, orderedIds),

  // 游戏状态
  getGameState: () => ipcRenderer.invoke(IPC.GAME_GET),
  saveGameState: (state: GameState) => ipcRenderer.invoke(IPC.GAME_SAVE, state),

  // 设置
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  saveSettings: (settings: Settings) => ipcRenderer.invoke(IPC.SETTINGS_SAVE, settings),
  onSettingsUpdated: (callback: (settings: Settings) => void) => {
    ipcRenderer.on(IPC.SETTINGS_UPDATED, (_event, settings: Settings) => callback(settings))
  },

  // 窗口
  toggleCollapse: (collapsed: boolean) => ipcRenderer.invoke(IPC.WINDOW_TOGGLE_COLLAPSE, collapsed),
  resizeWindow: (height: number) => ipcRenderer.invoke(IPC.WINDOW_RESIZE, height),
  openSettings: () => ipcRenderer.invoke(IPC.SETTINGS_WINDOW_OPEN),
  closeSettings: () => ipcRenderer.invoke(IPC.SETTINGS_WINDOW_CLOSE),
  toggleSettingsFullscreen: () => ipcRenderer.invoke(IPC.SETTINGS_WINDOW_FULLSCREEN),

  // 统计
  getStats: () => ipcRenderer.invoke(IPC.STATS_GET),
  getHistory: (limit?: number, offset?: number) =>
    ipcRenderer.invoke(IPC.HISTORY_GET, limit, offset),

  // 日志
  logError: (message: string) => ipcRenderer.send(IPC.LOG_ERROR, message)
}

contextBridge.exposeInMainWorld('api', api)
