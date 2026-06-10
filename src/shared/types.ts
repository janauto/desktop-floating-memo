/** 任务优先级 */
export type Priority = 'normal' | 'important' | 'urgent'

/** 任务状态（数据库内全生命周期） */
export type TaskStatus = 'active' | 'completed' | 'deleted'

/** 计时器状态 */
export type TimerStatus = 'running' | 'paused'

/** 任务实体（SQLite 为唯一真相源） */
export interface Task {
  id: string
  text: string
  priority: Priority
  tag: string
  status: TaskStatus
  sortOrder: number
  createdAt: number
  completedAt: number | null
  deletedAt: number | null
  timerStatus: TimerStatus
  lastStartTime: number | null
  accumulatedTime: number
  xpEarned: number
}

/** 新建任务的入参 */
export interface NewTaskInput {
  text: string
  priority: Priority
  tag: string
}

/** 游戏化状态（存于 electron-store） */
export interface GameState {
  xp: number
  level: number
  totalCompleted: number
  todayCompleted: number
  todayDate: string
  combo: number
  lastKillTime: number
  achievements: string[]
}

/** 应用设置（存于 electron-store） */
export interface Settings {
  comboWindow: number
  xpPerLevel: number
  xpNormal: number
  xpImportant: number
  xpUrgent: number
  blurOpacity: number
  alwaysOnTop: boolean
  showClock: boolean
  showTaskTimer: boolean
  particleCount: number
  screenShake: boolean
  tags: string[]
}

/** 成就定义 */
export interface Achievement {
  id: string
  name: string
  desc: string
}

/** 完成任务后的结算结果 */
export interface CompletionResult {
  state: GameState
  xpGained: number
  comboBonus: number
  combo: number
  leveledUp: boolean
  newLevel: number
  unlockedAchievements: Achievement[]
}

/** 看板统计 */
export interface DailyStat {
  date: string
  weekday: string
  count: number
  totalTime: number
}

export interface Stats {
  totalCompleted: number
  todayCompleted: number
  weekCompleted: number
  totalCreated: number
  totalDeleted: number
  avgTimeMs: number
  totalXp: number
  byPriority: { priority: string; c: number }[]
  byTag: { tag: string; c: number }[]
  hourCounts: number[]
  dailyStats: DailyStat[]
  completionRate: number
}

/** preload 暴露给渲染进程的 API 形状（contextBridge） */
export interface RendererApi {
  // 任务
  listTasks: () => Promise<Task[]>
  addTask: (input: NewTaskInput) => Promise<Task>
  completeTask: (id: string, xpEarned: number) => Promise<Task | null>
  deleteTask: (id: string) => Promise<boolean>
  toggleTaskTimer: (id: string) => Promise<Task | null>
  reorderTasks: (orderedIds: string[]) => Promise<boolean>
  // 游戏状态
  getGameState: () => Promise<GameState>
  saveGameState: (state: GameState) => Promise<boolean>
  // 设置
  getSettings: () => Promise<Settings>
  saveSettings: (settings: Settings) => Promise<boolean>
  onSettingsUpdated: (callback: (settings: Settings) => void) => void
  // 窗口
  toggleCollapse: (collapsed: boolean) => Promise<boolean>
  resizeWindow: (height: number) => Promise<void>
  openSettings: () => Promise<void>
  closeSettings: () => Promise<void>
  toggleSettingsFullscreen: () => Promise<boolean>
  // 统计
  getStats: () => Promise<Stats>
  getHistory: (limit?: number, offset?: number) => Promise<Task[]>
  // 日志
  logError: (message: string) => void
}
