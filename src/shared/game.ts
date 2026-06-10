/**
 * 游戏化核心逻辑 — 纯函数，无副作用，可单元测试。
 * 行为与 v1 保持一致：连击窗口、连击加成 XP、等级、成就（每次只解锁一个，+50 XP）。
 */
import type { Achievement, CompletionResult, GameState, Priority, Settings } from './types'

export const ACHIEVEMENT_XP_BONUS = 50

export const ACHIEVEMENTS: (Achievement & { check: (s: GameState) => boolean })[] = [
  { id: 'first_kill', name: '初次出击', desc: '完成第一个任务', check: (s) => s.totalCompleted >= 1 },
  { id: 'ten_kills', name: '小试牛刀', desc: '完成 10 个任务', check: (s) => s.totalCompleted >= 10 },
  { id: 'fifty_kills', name: '效率达人', desc: '完成 50 个任务', check: (s) => s.totalCompleted >= 50 },
  { id: 'hundred_kills', name: '任务终结者', desc: '完成 100 个任务', check: (s) => s.totalCompleted >= 100 },
  { id: 'combo_3', name: '三连击', desc: '达成 3 连击', check: (s) => s.combo >= 3 },
  { id: 'combo_5', name: '五杀！', desc: '达成 5 连击', check: (s) => s.combo >= 5 },
  { id: 'combo_10', name: '无人能挡', desc: '达成 10 连击', check: (s) => s.combo >= 10 },
  { id: 'level_5', name: '崭露头角', desc: '达到 5 级', check: (s) => s.level >= 5 },
  { id: 'level_10', name: '久经沙场', desc: '达到 10 级', check: (s) => s.level >= 10 }
]

export function xpForPriority(priority: Priority, settings: Settings): number {
  switch (priority) {
    case 'urgent':
      return settings.xpUrgent
    case 'important':
      return settings.xpImportant
    default:
      return settings.xpNormal
  }
}

export function levelForXp(xp: number, xpPerLevel: number): number {
  return Math.floor(xp / Math.max(1, xpPerLevel)) + 1
}

/**
 * 完成一个任务后的完整结算：基础 XP → 连击 → 升级 → 成就。
 * 返回新状态与所有需要触发 UI 反馈的事件信息。不修改入参。
 */
export function applyTaskCompletion(
  prev: GameState,
  priority: Priority,
  settings: Settings,
  now: number = Date.now()
): CompletionResult {
  const state: GameState = { ...prev, achievements: [...prev.achievements] }

  const xpGained = xpForPriority(priority, settings)
  state.xp += xpGained
  state.totalCompleted += 1
  state.todayCompleted += 1

  // 连击判定（lastKillTime 为 0 表示从未完成过任务，不触发连击）
  let comboBonus = 0
  if (state.lastKillTime > 0 && now - state.lastKillTime < settings.comboWindow) {
    state.combo += 1
    comboBonus = Math.floor(state.combo * 5)
    state.xp += comboBonus
  } else {
    state.combo = 1
  }
  state.lastKillTime = now

  // 升级判定
  const newLevel = levelForXp(state.xp, settings.xpPerLevel)
  const leveledUp = newLevel > state.level
  if (leveledUp) state.level = newLevel

  // 成就判定（与 v1 一致：每次完成最多解锁一个，奖励 50 XP）
  const unlockedAchievements: Achievement[] = []
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.check(state)) {
      state.achievements.push(a.id)
      state.xp += ACHIEVEMENT_XP_BONUS
      unlockedAchievements.push({ id: a.id, name: a.name, desc: a.desc })
      break
    }
  }

  return {
    state,
    xpGained,
    comboBonus,
    combo: state.combo,
    leveledUp,
    newLevel: state.level,
    unlockedAchievements
  }
}

/** 番茄钟专注完成奖励 */
export const POMODORO_XP_REWARD = 15

export function applyPomodoroCompletion(
  prev: GameState,
  settings: Settings
): { state: GameState; leveledUp: boolean; newLevel: number } {
  const state: GameState = { ...prev, achievements: [...prev.achievements] }
  state.xp += POMODORO_XP_REWARD
  const newLevel = levelForXp(state.xp, settings.xpPerLevel)
  const leveledUp = newLevel > state.level
  if (leveledUp) state.level = newLevel
  return { state, leveledUp, newLevel: state.level }
}

/** 跨天重置今日计数与连击 */
export function resetTodayIfNeeded(prev: GameState, today: string = new Date().toDateString()): GameState {
  if (prev.todayDate === today) return prev
  return { ...prev, todayCompleted: 0, todayDate: today, combo: 0 }
}
