const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function getDb() {
  if (db) return db;
  const dbPath = path.join(app.getPath('userData'), 'memo_history.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  initTables();
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_history (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      tag TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      deleted_at INTEGER,
      accumulated_time INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      xp_earned INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_status ON task_history(status);
    CREATE INDEX IF NOT EXISTS idx_created ON task_history(created_at);
  `);
}

// ---- CRUD ----

function addRecord(task) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO task_history (id, text, priority, tag, created_at, accumulated_time, status)
    VALUES (@id, @text, @priority, @tag, @createdAt, @accumulatedTime, 'active')
  `);
  stmt.run({
    id: task.id,
    text: task.text,
    priority: task.priority || 'normal',
    tag: task.tag || '',
    createdAt: task.createdAt || Date.now(),
    accumulatedTime: task.accumulatedTime || 0
  });
}

function completeRecord(id, accumulatedTime, xpEarned) {
  const stmt = getDb().prepare(`
    UPDATE task_history 
    SET status = 'completed', completed_at = ?, accumulated_time = ?, xp_earned = ?
    WHERE id = ?
  `);
  stmt.run(Date.now(), accumulatedTime || 0, xpEarned || 0, id);
}

function deleteRecord(id) {
  const stmt = getDb().prepare(`
    UPDATE task_history SET status = 'deleted', deleted_at = ? WHERE id = ?
  `);
  stmt.run(Date.now(), id);
}

function getHistory(limit = 200, offset = 0) {
  return getDb().prepare(`
    SELECT * FROM task_history ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
}

function getStats() {
  const d = getDb();
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const weekStart = todayStart - 6 * 86400000;

  const total = d.prepare(`SELECT COUNT(*) as c FROM task_history WHERE status = 'completed'`).get();
  const todayCompleted = d.prepare(`SELECT COUNT(*) as c FROM task_history WHERE status = 'completed' AND completed_at >= ?`).get(todayStart);
  const weekCompleted = d.prepare(`SELECT COUNT(*) as c FROM task_history WHERE status = 'completed' AND completed_at >= ?`).get(weekStart);
  const totalCreated = d.prepare(`SELECT COUNT(*) as c FROM task_history`).get();
  const totalDeleted = d.prepare(`SELECT COUNT(*) as c FROM task_history WHERE status = 'deleted'`).get();
  const avgTime = d.prepare(`SELECT AVG(accumulated_time) as avg FROM task_history WHERE status = 'completed' AND accumulated_time > 0`).get();
  const totalXp = d.prepare(`SELECT SUM(xp_earned) as s FROM task_history WHERE status = 'completed'`).get();

  // Priority distribution
  const byPriority = d.prepare(`
    SELECT priority, COUNT(*) as c FROM task_history WHERE status = 'completed' GROUP BY priority
  `).all();

  // Hourly distribution (completion hour)
  const hourly = d.prepare(`
    SELECT * FROM task_history WHERE status = 'completed' AND completed_at IS NOT NULL
  `).all();

  const hourCounts = new Array(24).fill(0);
  hourly.forEach(r => {
    const h = new Date(r.completed_at).getHours();
    hourCounts[h]++;
  });

  // Daily stats for the last 7 days
  const dailyStats = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = todayStart - i * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayCount = d.prepare(`SELECT COUNT(*) as c FROM task_history WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`).get(dayStart, dayEnd);
    const dayTime = d.prepare(`SELECT SUM(accumulated_time) as s FROM task_history WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`).get(dayStart, dayEnd);
    const date = new Date(dayStart);
    dailyStats.push({
      date: `${(date.getMonth()+1)}/${date.getDate()}`,
      weekday: ['日','一','二','三','四','五','六'][date.getDay()],
      count: dayCount.c,
      totalTime: dayTime.s || 0
    });
  }

  // Tag distribution
  const byTag = d.prepare(`
    SELECT tag, COUNT(*) as c FROM task_history WHERE status = 'completed' AND tag != '' GROUP BY tag
  `).all();

  return {
    totalCompleted: total.c,
    todayCompleted: todayCompleted.c,
    weekCompleted: weekCompleted.c,
    totalCreated: totalCreated.c,
    totalDeleted: totalDeleted.c,
    avgTimeMs: avgTime.avg || 0,
    totalXp: totalXp.s || 0,
    byPriority,
    hourCounts,
    dailyStats,
    byTag,
    completionRate: totalCreated.c > 0 ? Math.round((total.c / totalCreated.c) * 100) : 0
  };
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { addRecord, completeRecord, deleteRecord, getHistory, getStats, close };
