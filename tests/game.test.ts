import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENT_XP_BONUS,
  applyPomodoroCompletion,
  applyTaskCompletion,
  levelForXp,
  POMODORO_XP_REWARD,
  resetTodayIfNeeded,
  xpForPriority
} from '../src/shared/game'
import { DEFAULT_SETTINGS, defaultGameState } from '../src/shared/constants'
import type { GameState } from '../src/shared/types'

const settings = { ...DEFAULT_SETTINGS }

function freshState(overrides: Partial<GameState> = {}): GameState {
  return { ...defaultGameState(), ...overrides }
}

describe('xpForPriority', () => {
  it('按优先级返回对应 XP', () => {
    expect(xpForPriority('normal', settings)).toBe(10)
    expect(xpForPriority('important', settings)).toBe(20)
    expect(xpForPriority('urgent', settings)).toBe(30)
  })
})

describe('levelForXp', () => {
  it('0 XP 为 1 级，每 100 XP 升一级', () => {
    expect(levelForXp(0, 100)).toBe(1)
    expect(levelForXp(99, 100)).toBe(1)
    expect(levelForXp(100, 100)).toBe(2)
    expect(levelForXp(250, 100)).toBe(3)
  })

  it('xpPerLevel 为 0 时不除零', () => {
    expect(levelForXp(50, 0)).toBe(51)
  })
})

describe('applyTaskCompletion', () => {
  it('首次完成：获得基础 XP、连击置 1、解锁 first_kill 成就', () => {
    const result = applyTaskCompletion(freshState(), 'normal', settings, 1000)

    expect(result.xpGained).toBe(10)
    expect(result.combo).toBe(1)
    expect(result.comboBonus).toBe(0)
    expect(result.unlockedAchievements.map((a) => a.id)).toEqual(['first_kill'])
    // 10 (基础) + 50 (成就奖励)
    expect(result.state.xp).toBe(10 + ACHIEVEMENT_XP_BONUS)
    expect(result.state.totalCompleted).toBe(1)
    expect(result.state.todayCompleted).toBe(1)
    expect(result.state.lastKillTime).toBe(1000)
  })

  it('连击窗口内完成：combo 递增并获得 combo*5 加成', () => {
    const first = applyTaskCompletion(freshState(), 'normal', settings, 1000)
    const second = applyTaskCompletion(first.state, 'normal', settings, 3000) // 2s < 5s 窗口

    expect(second.combo).toBe(2)
    expect(second.comboBonus).toBe(10) // floor(2*5)
  })

  it('超出连击窗口：combo 重置为 1', () => {
    const first = applyTaskCompletion(freshState(), 'normal', settings, 1000)
    const second = applyTaskCompletion(first.state, 'normal', settings, 1000 + 6000)

    expect(second.combo).toBe(1)
    expect(second.comboBonus).toBe(0)
  })

  it('跨越等级阈值时触发升级', () => {
    const state = freshState({ xp: 95, achievements: ['first_kill'] })
    const result = applyTaskCompletion(state, 'normal', settings, 1000)

    expect(result.leveledUp).toBe(true)
    expect(result.newLevel).toBe(2)
  })

  it('每次最多解锁一个成就', () => {
    // totalCompleted 将达到 10，同时 combo 也达到 3 → 只解锁一个
    const state = freshState({
      totalCompleted: 9,
      combo: 2,
      lastKillTime: 900,
      achievements: ['first_kill']
    })
    const result = applyTaskCompletion(state, 'normal', settings, 1000)

    expect(result.unlockedAchievements).toHaveLength(1)
  })

  it('已解锁的成就不重复触发', () => {
    const state = freshState({ totalCompleted: 5, achievements: ['first_kill'] })
    const result = applyTaskCompletion(state, 'normal', settings, 1000)
    expect(result.unlockedAchievements).toHaveLength(0)
  })

  it('不修改入参状态（纯函数）', () => {
    const state = freshState()
    const before = JSON.stringify(state)
    applyTaskCompletion(state, 'urgent', settings, 1000)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('applyPomodoroCompletion', () => {
  it('奖励 15 XP 并检查升级', () => {
    const result = applyPomodoroCompletion(freshState({ xp: 90 }), settings)
    expect(result.state.xp).toBe(90 + POMODORO_XP_REWARD)
    expect(result.leveledUp).toBe(true)
    expect(result.newLevel).toBe(2)
  })
})

describe('resetTodayIfNeeded', () => {
  it('同一天不变', () => {
    const state = freshState({ todayCompleted: 5, todayDate: 'Mon Jun 08 2026', combo: 3 })
    const result = resetTodayIfNeeded(state, 'Mon Jun 08 2026')
    expect(result).toBe(state)
  })

  it('跨天重置今日计数与连击', () => {
    const state = freshState({ todayCompleted: 5, todayDate: 'Mon Jun 08 2026', combo: 3, xp: 120 })
    const result = resetTodayIfNeeded(state, 'Tue Jun 09 2026')
    expect(result.todayCompleted).toBe(0)
    expect(result.combo).toBe(0)
    expect(result.todayDate).toBe('Tue Jun 09 2026')
    expect(result.xp).toBe(120) // 其他字段不动
  })
})
