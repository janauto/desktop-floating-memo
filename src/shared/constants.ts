import type { GameState, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  comboWindow: 5000,
  xpPerLevel: 100,
  xpNormal: 10,
  xpImportant: 20,
  xpUrgent: 30,
  blurOpacity: 0.55,
  alwaysOnTop: true,
  showClock: true,
  showTaskTimer: true,
  particleCount: 24,
  screenShake: true,
  tags: ['需求', '会议', '💡想法', '🐛Bug']
}

export function defaultGameState(): GameState {
  return {
    xp: 0,
    level: 1,
    totalCompleted: 0,
    todayCompleted: 0,
    todayDate: new Date().toDateString(),
    combo: 0,
    lastKillTime: 0,
    achievements: []
  }
}

/** 窗口尺寸 */
export const WINDOW = {
  DEFAULT_WIDTH: 380,
  EXPANDED_HEIGHT: 560,
  COLLAPSED_HEIGHT: 48,
  MIN_CONTENT_HEIGHT: 50
} as const

/** IPC 通道名（集中管理，主进程与 preload 共用） */
export const IPC = {
  TASKS_LIST: 'tasks:list',
  TASKS_ADD: 'tasks:add',
  TASKS_COMPLETE: 'tasks:complete',
  TASKS_DELETE: 'tasks:delete',
  TASKS_TOGGLE_TIMER: 'tasks:toggle-timer',
  TASKS_REORDER: 'tasks:reorder',
  GAME_GET: 'game:get',
  GAME_SAVE: 'game:save',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_UPDATED: 'settings:updated',
  WINDOW_TOGGLE_COLLAPSE: 'window:toggle-collapse',
  WINDOW_RESIZE: 'window:resize',
  SETTINGS_WINDOW_OPEN: 'settings-window:open',
  SETTINGS_WINDOW_CLOSE: 'settings-window:close',
  SETTINGS_WINDOW_FULLSCREEN: 'settings-window:toggle-fullscreen',
  STATS_GET: 'stats:get',
  HISTORY_GET: 'history:get',
  LOG_ERROR: 'log:error'
} as const
