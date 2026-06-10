/**
 * 数据层集成测试：内存 SQLite，覆盖 CRUD、排序、迁移、损坏恢复。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/connection'
import { TaskRepository } from '../src/main/db/taskRepository'
import { StatsRepository } from '../src/main/db/statsRepository'

let db: Database.Database
let repo: TaskRepository

beforeEach(() => {
  db = openDatabase(':memory:')
  repo = new TaskRepository(db)
})

afterEach(() => {
  db.close()
})

describe('TaskRepository', () => {
  it('add 后 listActive 返回任务，新任务在最前', () => {
    repo.add({ text: '第一个', priority: 'normal', tag: '' }, 1000)
    repo.add({ text: '第二个', priority: 'urgent', tag: '需求' }, 2000)

    const tasks = repo.listActive()
    expect(tasks).toHaveLength(2)
    expect(tasks[0].text).toBe('第二个')
    expect(tasks[0].priority).toBe('urgent')
    expect(tasks[0].timerStatus).toBe('running')
  })

  it('complete 结算运行中的计时并记录 XP', () => {
    const task = repo.add({ text: 't', priority: 'normal', tag: '' }, 1000)
    const completed = repo.complete(task.id, 10, 6000)

    expect(completed?.status).toBe('completed')
    expect(completed?.accumulatedTime).toBe(5000) // 6000 - 1000
    expect(completed?.xpEarned).toBe(10)
    expect(repo.listActive()).toHaveLength(0)
  })

  it('complete 不存在或非 active 的任务返回 null', () => {
    expect(repo.complete('nope', 10)).toBeNull()
    const task = repo.add({ text: 't', priority: 'normal', tag: '' })
    repo.complete(task.id, 10)
    expect(repo.complete(task.id, 10)).toBeNull() // 二次完成无效
  })

  it('softDelete 保留历史记录', () => {
    const task = repo.add({ text: 't', priority: 'normal', tag: '' })
    expect(repo.softDelete(task.id)).toBe(true)
    expect(repo.listActive()).toHaveLength(0)
    expect(repo.history()).toHaveLength(1)
    expect(repo.history()[0].status).toBe('deleted')
  })

  it('toggleTimer 暂停时结算耗时，恢复时重新计时', () => {
    const task = repo.add({ text: 't', priority: 'normal', tag: '' }, 1000)

    const paused = repo.toggleTimer(task.id, 4000)
    expect(paused?.timerStatus).toBe('paused')
    expect(paused?.accumulatedTime).toBe(3000)
    expect(paused?.lastStartTime).toBeNull()

    const resumed = repo.toggleTimer(task.id, 10000)
    expect(resumed?.timerStatus).toBe('running')
    expect(resumed?.accumulatedTime).toBe(3000)
    expect(resumed?.lastStartTime).toBe(10000)
  })

  it('reorder 重写排序', () => {
    const a = repo.add({ text: 'a', priority: 'normal', tag: '' }, 1000)
    const b = repo.add({ text: 'b', priority: 'normal', tag: '' }, 2000)
    const c = repo.add({ text: 'c', priority: 'normal', tag: '' }, 3000)
    // 当前顺序: c, b, a → 改为 a, c, b
    repo.reorder([a.id, c.id, b.id])

    expect(repo.listActive().map((t) => t.text)).toEqual(['a', 'c', 'b'])
  })

  it('importLegacyTasks 导入旧 store 数据并跳过坏记录', () => {
    const count = repo.importLegacyTasks([
      { id: 'legacy-1', text: '旧任务', priority: 'important', tag: '会议', createdAt: 123, accumulatedTime: 50, timerStatus: 'paused' },
      { text: '' }, // 无效
      null as never,
      { text: '无 id 任务' }
    ])
    expect(count).toBe(2)
    const tasks = repo.listActive()
    expect(tasks).toHaveLength(2)
    expect(tasks.find((t) => t.id === 'legacy-1')?.tag).toBe('会议')
  })
})

describe('schema migration', () => {
  it('从旧版 task_history 表迁移数据（文件库）', () => {
    const path = `/tmp/memo-test-${Date.now()}.db`
    const legacy = new Database(path)
    legacy.exec(`
      CREATE TABLE task_history (
        id TEXT PRIMARY KEY, text TEXT NOT NULL, priority TEXT DEFAULT 'normal',
        tag TEXT DEFAULT '', created_at INTEGER NOT NULL, completed_at INTEGER,
        deleted_at INTEGER, accumulated_time INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active', xp_earned INTEGER DEFAULT 0
      );
      INSERT INTO task_history (id, text, priority, created_at, completed_at, status, xp_earned)
      VALUES ('h1', '历史任务', 'urgent', 100, 200, 'completed', 30);
    `)
    legacy.close()

    const migrated = openDatabase(path)
    const repo2 = new TaskRepository(migrated)
    const history = repo2.history()
    expect(history).toHaveLength(1)
    expect(history[0].id).toBe('h1')
    expect(history[0].status).toBe('completed')
    expect(history[0].xpEarned).toBe(30)
    migrated.close()
  })
})

describe('StatsRepository', () => {
  it('统计完成数、完成率与 7 日趋势', () => {
    const stats = new StatsRepository(db)
    const now = Date.now()

    const t1 = repo.add({ text: 'a', priority: 'normal', tag: '需求' }, now - 1000)
    const t2 = repo.add({ text: 'b', priority: 'urgent', tag: '' }, now - 1000)
    repo.add({ text: 'c', priority: 'normal', tag: '' }, now - 1000) // 未完成
    repo.complete(t1.id, 10, now)
    repo.complete(t2.id, 30, now)

    const s = stats.getStats(now)
    expect(s.totalCompleted).toBe(2)
    expect(s.todayCompleted).toBe(2)
    expect(s.weekCompleted).toBe(2)
    expect(s.totalCreated).toBe(3)
    expect(s.completionRate).toBe(67)
    expect(s.totalXp).toBe(40)
    expect(s.dailyStats).toHaveLength(7)
    expect(s.dailyStats[6].count).toBe(2) // 今天
    expect(s.hourCounts.reduce((a, b) => a + b, 0)).toBe(2)
    expect(s.byTag).toEqual([{ tag: '需求', c: 1 }])
  })
})
