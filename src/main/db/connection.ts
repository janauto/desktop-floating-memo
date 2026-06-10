/**
 * 数据库连接管理：打开、完整性自检、损坏自动备份重建、schema 迁移。
 * 不依赖 electron，便于单元测试（传入任意路径或 ':memory:'）。
 */
import Database from 'better-sqlite3'
import fs from 'fs'

export interface Logger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

const noopLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} }

const SCHEMA_VERSION = 2

/**
 * 打开数据库。若文件损坏（打开失败或 integrity_check 不通过），
 * 将原文件备份为 *.corrupt-<timestamp> 后重建，保证应用始终可启动。
 */
export function openDatabase(dbPath: string, log: Logger = noopLogger): Database.Database {
  let db = tryOpen(dbPath, log)
  if (!db) {
    backupCorruptFile(dbPath, log)
    db = new Database(dbPath)
  }

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db, log)
  return db
}

function tryOpen(dbPath: string, log: Logger): Database.Database | null {
  let db: Database.Database | null = null
  try {
    db = new Database(dbPath)
    const result = db.pragma('integrity_check', { simple: true })
    if (result !== 'ok') throw new Error(`integrity_check failed: ${String(result)}`)
    return db
  } catch (err) {
    log.error('[db] open/integrity failed, recreating database', err)
    if (db) {
      try {
        db.close()
      } catch {
        /* ignore */
      }
    }
    return null
  }
}

function backupCorruptFile(dbPath: string, log: Logger): void {
  if (dbPath === ':memory:' || !fs.existsSync(dbPath)) return
  const backupPath = `${dbPath}.corrupt-${Date.now()}`
  try {
    fs.renameSync(dbPath, backupPath)
    for (const suffix of ['-wal', '-shm']) {
      const f = dbPath + suffix
      if (fs.existsSync(f)) fs.renameSync(f, backupPath + suffix)
    }
    log.warn(`[db] corrupt database backed up to ${backupPath}`)
  } catch (err) {
    log.error('[db] failed to backup corrupt database, deleting', err)
    try {
      fs.unlinkSync(dbPath)
    } catch {
      /* ignore */
    }
  }
}

function getVersion(db: Database.Database): number {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')
  const row = db.prepare('SELECT version FROM schema_version').get() as
    | { version: number }
    | undefined
  if (!row) {
    db.prepare('INSERT INTO schema_version (version) VALUES (0)').run()
    return 0
  }
  return row.version
}

function setVersion(db: Database.Database, v: number): void {
  db.prepare('UPDATE schema_version SET version = ?').run(v)
}

/** 顺序执行 schema 迁移；每个版本在事务中完成 */
function migrate(db: Database.Database, log: Logger): void {
  let version = getVersion(db)
  if (version >= SCHEMA_VERSION) return

  const run = db.transaction(() => {
    if (version < 1) {
      // v1: 统一任务表（取代 v1.x 的 task_history + electron-store 双写）
      db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'normal',
          tag TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          completed_at INTEGER,
          deleted_at INTEGER,
          timer_status TEXT NOT NULL DEFAULT 'running',
          last_start_time INTEGER,
          accumulated_time INTEGER NOT NULL DEFAULT 0,
          xp_earned INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks(status, sort_order);
      `)
      version = 1
    }
    if (version < 2) {
      // v2: 从旧版 task_history 表导入历史数据（若存在）
      const legacy = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_history'`)
        .get()
      if (legacy) {
        db.exec(`
          INSERT OR IGNORE INTO tasks
            (id, text, priority, tag, status, created_at, completed_at, deleted_at,
             accumulated_time, xp_earned, timer_status, last_start_time)
          SELECT id, text, COALESCE(priority, 'normal'), COALESCE(tag, ''),
                 COALESCE(status, 'active'), created_at, completed_at, deleted_at,
                 COALESCE(accumulated_time, 0), COALESCE(xp_earned, 0),
                 'paused', NULL
          FROM task_history;
          ALTER TABLE task_history RENAME TO task_history_migrated_v1;
        `)
        log.info('[db] migrated legacy task_history table')
      }
      version = 2
    }
    setVersion(db, SCHEMA_VERSION)
  })

  run()
  log.info(`[db] schema at version ${SCHEMA_VERSION}`)
}
