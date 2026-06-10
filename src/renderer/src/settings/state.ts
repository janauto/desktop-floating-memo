/** 设置窗口的共享状态与持久化助手 */
import type { Settings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/constants'

export const state: { settings: Settings } = {
  settings: { ...DEFAULT_SETTINGS }
}

export async function loadSettings(): Promise<void> {
  state.settings = { ...DEFAULT_SETTINGS, ...(await window.api.getSettings()) }
}

export function saveSettings(): void {
  void window.api
    .saveSettings(state.settings)
    .catch((err) => window.api.logError(`saveSettings failed: ${String(err)}`))
}
