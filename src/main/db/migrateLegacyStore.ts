/**
 * 一次性迁移：把旧版本存在 electron-store 里的活动任务导入 SQLite，
 * 成功后删除 store 中的 tasks 键，彻底消除双真相源。
 */
import type { Task } from '@shared/types'
import type { Logger } from './connection'
import type { TaskRepository } from './taskRepository'
import type { AppStore } from '../settingsStore'

export function migrateLegacyStoreTasks(
  store: AppStore,
  repo: TaskRepository,
  log: Logger
): void {
  const legacyTasks = store.get('tasks')
  if (!Array.isArray(legacyTasks) || legacyTasks.length === 0) {
    if (legacyTasks !== undefined) store.delete('tasks')
    return
  }

  try {
    const imported = repo.importLegacyTasks(legacyTasks as Partial<Task>[])
    store.delete('tasks')
    log.info(`[migrate] imported ${imported}/${legacyTasks.length} legacy tasks from electron-store`)
  } catch (err) {
    log.error('[migrate] failed to import legacy tasks, keeping store data for retry', err)
  }
}
