/**
 * 统计仓库 — 看板数据。
 * 修复 v1 的 N+1 查询：7 日趋势与 24 小时分布各用一次范围查询在内存聚合。
 */
import type Database from 'better-sqlite3'
import type { Stats } from '@shared/types'

const DAY_MS = 86400000
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export class StatsRepository {
  constructor(private readonly db: Database.Database) {}

  getStats(now: number = Date.now()): Stats {
    const d = this.db
    const todayStart = new Date(now).setHours(0, 0, 0, 0)
    const weekStart = todayStart - 6 * DAY_MS

    const scalar = (sql: string, ...params: unknown[]): number => {
      const row = d.prepare(sql).get(...params) as Record<string, number | null>
      const value = Object.values(row)[0]
      return value ?? 0
    }

    const totalCompleted = scalar(`SELECT COUNT(*) FROM tasks WHERE status = 'completed'`)
    const todayCompleted = scalar(
      `SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND completed_at >= ?`,
      todayStart
    )
    const weekCompleted = scalar(
      `SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND completed_at >= ?`,
      weekStart
    )
    const totalCreated = scalar(`SELECT COUNT(*) FROM tasks`)
    const totalDeleted = scalar(`SELECT COUNT(*) FROM tasks WHERE status = 'deleted'`)
    const avgTimeMs = scalar(
      `SELECT AVG(accumulated_time) FROM tasks WHERE status = 'completed' AND accumulated_time > 0`
    )
    const totalXp = scalar(`SELECT SUM(xp_earned) FROM tasks WHERE status = 'completed'`)

    const byPriority = d
      .prepare(`SELECT priority, COUNT(*) AS c FROM tasks WHERE status = 'completed' GROUP BY priority`)
      .all() as { priority: string; c: number }[]

    const byTag = d
      .prepare(
        `SELECT tag, COUNT(*) AS c FROM tasks WHERE status = 'completed' AND tag != '' GROUP BY tag`
      )
      .all() as { tag: string; c: number }[]

    // 24 小时分布：一次查询全部完成时间，在内存按小时聚合
    const completedTimes = d
      .prepare(`SELECT completed_at FROM tasks WHERE status = 'completed' AND completed_at IS NOT NULL`)
      .all() as { completed_at: number }[]
    const hourCounts = new Array<number>(24).fill(0)
    for (const r of completedTimes) {
      hourCounts[new Date(r.completed_at).getHours()]++
    }

    // 最近 7 日趋势：单次范围查询 + 内存按天聚合（替代 v1 的 14 次循环查询）
    const weekRows = d
      .prepare(
        `SELECT completed_at, accumulated_time FROM tasks
         WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`
      )
      .all(weekStart, todayStart + DAY_MS) as { completed_at: number; accumulated_time: number }[]

    const dailyStats = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = todayStart - i * DAY_MS
      const dayEnd = dayStart + DAY_MS
      const inDay = weekRows.filter((r) => r.completed_at >= dayStart && r.completed_at < dayEnd)
      const date = new Date(dayStart)
      dailyStats.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        weekday: WEEKDAYS[date.getDay()],
        count: inDay.length,
        totalTime: inDay.reduce((sum, r) => sum + (r.accumulated_time || 0), 0)
      })
    }

    return {
      totalCompleted,
      todayCompleted,
      weekCompleted,
      totalCreated,
      totalDeleted,
      avgTimeMs,
      totalXp,
      byPriority,
      byTag,
      hourCounts,
      dailyStats,
      completionRate: totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0
    }
  }
}
