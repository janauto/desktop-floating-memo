/**
 * electron-store 只负责轻量配置：设置、窗口位置、游戏化状态。
 * 任务数据一律走 SQLite（见 db/taskRepository.ts）。
 */
import Store from 'electron-store'
import type { GameState, Settings } from '@shared/types'
import { DEFAULT_SETTINGS, WINDOW, defaultGameState } from '@shared/constants'

export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

interface StoreSchema {
  settings: Settings
  gameState: GameState
  windowBounds: WindowBounds
  /** 旧版残留的任务数组，迁移后删除 */
  tasks?: unknown[]
}

export type AppStore = Store<StoreSchema>

export function createStore(): AppStore {
  return new Store<StoreSchema>({
    defaults: {
      settings: DEFAULT_SETTINGS,
      gameState: defaultGameState(),
      windowBounds: {
        width: WINDOW.DEFAULT_WIDTH,
        height: WINDOW.EXPANDED_HEIGHT
      }
    },
    // 配置文件损坏时不抛异常，回退默认值（崩溃恢复）
    clearInvalidConfig: true
  })
}

export function getSettings(store: AppStore): Settings {
  return { ...DEFAULT_SETTINGS, ...store.get('settings') }
}

export function getGameState(store: AppStore): GameState {
  return { ...defaultGameState(), ...store.get('gameState') }
}
