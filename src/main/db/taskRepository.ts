/**
 * 任务仓库 — SQLite 是任务数据的唯一真相源。
 * 所有写操作落库即生效，渲染进程只持有只读缓存。
 */
import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { NewTaskInput, Task } from '@shared/types'
import { toggleTimer } from '@shared/time'

interface TaskRow {
  id: string
  text: string
  priority: string
  tag: string
  status: string
  sort_order: number
  created_at: number
  completed_at: number | null
  deleted_at: number | null
  timer_status: string
  last_start_time: number | null
  accumulated_time: number
  xp_earned: number
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    text: r.text,
    priority: r.priority as Task['priority'],
    tag: r.tag,
    status: r.status as Task['status'],
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    deletedAt: r.deleted_at,
    timerStatus: r.timer_status as Task['timerStatus'],
    lastStartTime: r.last_start_time,
    accumulatedTime: r.accumulated_time,
    xpEarned: r.xp_earned
  }
}

export class TaskRepository {
  constructor(private readonly db: Database.Database) {}

  /** 活动任务列表（按 sort_order 升序，即 UI 顺序） */
  listActive(): Task[] {
    const rows = this.db
      .prepare(`SELECT * FROM tasks WHERE status = 'active' ORDER BY sort_order ASC, created_at DESC`)
      .all() as TaskRow[]
    return rows.map(rowToTask)
  }

  getById(id: string): Task | null {
    const row = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined
    return row ? rowToTask(row) : null
  }

  /** 新任务插入到列表顶部（sort_order 取当前最小值 - 1） */
  add(input: NewTaskInput, now: number = Date.now()): Task {
    const minOrder = this.db
      .prepare(`SELECT COALESCE(MIN(sort_order), 0) AS m FROM tasks WHERE status = 'active'`)
      .get() as { m: number }

    const task: Task = {
      id: randomUUID(),
      text: input.text,
      priority: input.priority,
      tag: input.tag,
      status: 'active',
      sortOrder: minOrder.m - 1,
      createdAt: now,
      completedAt: null,
      deletedAt: null,
      timerStatus: 'running',
      lastStartTime: now,
      accumulatedTime: 0,
      xpEarned: 0
    }

    this.db
      .prepare(
        `INSERT INTO tasks
           (id, text, priority, tag, status, sort_order, created_at,
            timer_status, last_start_time, accumulated_time, xp_earned)
         VALUES (@id, @text, @priority, @tag, @status, @sortOrder, @createdAt,
                 @timerStatus, @lastStartTime, @accumulatedTime, @xpEarned)`
      )
      .run({
        id: task.id,
        text: task.text,
        priority: task.priority,
        tag: task.tag,
        status: task.status,
        sortOrder: task.sortOrder,
        createdAt: task.createdAt,
        timerStatus: task.timerStatus,
        lastStartTime: task.lastStartTime,
        accumulatedTime: task.accumulatedTime,
        xpEarned: task.xpEarned
      })

    return task
  }

  /** 完成任务：结算累计耗时（含运行中的活动段）并记录所得 XP */
  complete(id: string, xpEarned: number, now: number = Date.now()): Task | null {
    const task = this.getById(id)
    if (!task || task.status !== 'active') return null

    let accumulated = task.accumulatedTime
    if (task.timerStatus === 'running' && task.lastStartTime != null) {
      accumulated += Math.max(0, now - task.lastStartTime)
    }

    this.db
      .prepare(
        `UPDATE tasks
         SET status = 'completed', completed_at = ?, accumulated_time = ?,
             xp_earned = ?, timer_status = 'paused', last_start_time = NULL
         WHERE id = ?`
      )
      .run(now, accumulated, xpEarned, id)

    return this.getById(id)
  }

  /** 软删除：保留在历史中用于统计 */
  softDelete(id: string, now: number = Date.now()): boolean {
    const result = this.db
      .prepare(
        `UPDATE tasks SET status = 'deleted', deleted_at = ? WHERE id = ? AND status = 'active'`
      )
      .run(now, id)
    return result.changes > 0
  }

  /** 暂停/恢复计时 */
  toggleTimer(id: string, now: number = Date.now()): Task | null {
    const task = this.getById(id)
    if (!task || task.status !== 'active') return null

    const next = toggleTimer(task, now)
    this.db
      .prepare(
        `UPDATE tasks SET timer_status = ?, last_start_time = ?, accumulated_time = ? WHERE id = ?`
      )
      .run(next.timerStatus, next.lastStartTime, next.accumulatedTime, id)

    return this.getById(id)
  }

  /** 拖拽排序：按给定 id 顺序重写 sort_order */
  reorder(orderedIds: string[]): boolean {
    const stmt = this.db.prepare(`UPDATE tasks SET sort_order = ? WHERE id = ? AND status = 'active'`)
    const run = this.db.transaction((ids: string[]) => {
      ids.forEach((id, index) => stmt.run(index, id))
    })
    run(orderedIds)
    return true
  }

  /** 历史记录（含已完成/已删除），供看板使用 */
  history(limit = 200, offset = 0): Task[] {
    const rows = this.db
      .prepare(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(Math.min(Math.max(1, limit), 1000), Math.max(0, offset)) as TaskRow[]
    return rows.map(rowToTask)
  }

  /** 批量导入（旧版 electron-store 迁移用） */
  importLegacyTasks(tasks: Partial<Task>[]): number {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO tasks
         (id, text, priority, tag, status, sort_order, created_at,
          timer_status, last_start_time, accumulated_time, xp_earned)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 0)`
    )
    let count = 0
    const run = this.db.transaction((items: Partial<Task>[]) => {
      items.forEach((t, index) => {
        if (!t || typeof t.text !== 'string' || !t.text) return
        const result = insert.run(
          typeof t.id === 'string' && t.id ? t.id : randomUUID(),
          t.text,
          t.priority === 'important' || t.priority === 'urgent' ? t.priority : 'normal',
          typeof t.tag === 'string' ? t.tag : '',
          index,
          typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
          t.timerStatus === 'paused' ? 'paused' : 'running',
          typeof t.lastStartTime === 'number' ? t.lastStartTime : Date.now(),
          typeof t.accumulatedTime === 'number' ? t.accumulatedTime : 0
        )
        count += result.changes
      })
    })
    run(tasks)
    return count
  }
}
