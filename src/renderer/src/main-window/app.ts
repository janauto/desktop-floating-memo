/**
 * 主窗口编排器。
 * 职责边界：只做 UI 编排与状态缓存。
 * - 业务规则（XP/连击/成就/计时）在 @shared 纯函数中
 * - 数据持久化在主进程（SQLite + electron-store）
 */
import type { GameState, Priority, Settings, Task } from '@shared/types'
import { DEFAULT_SETTINGS, defaultGameState } from '@shared/constants'
import {
  applyPomodoroCompletion,
  applyTaskCompletion,
  POMODORO_XP_REWARD,
  resetTodayIfNeeded
} from '@shared/game'
import { elapsedMs, formatElapsed, timerColorClass } from '@shared/time'
import { ParticleEngine } from './particles'
import { PomodoroTimer } from './pomodoro'
import { startClock } from './clock'
import { initQuotes } from './quotesWidget'

const TIMER_COLOR_CLASSES = ['running-color', 'long-running-color', 'very-long-color', 'paused-color']

export class FloatingMemoApp {
  private tasks: Task[] = []
  private gameState: GameState = defaultGameState()
  private settings: Settings = { ...DEFAULT_SETTINGS }

  private currentPriority: Priority = 'normal'
  private currentTag = ''
  private isCollapsed = false
  private comboTimeout: number | null = null
  private particles!: ParticleEngine

  async init(): Promise<void> {
    const clockEl = document.getElementById('liveClock')
    if (clockEl) startClock(clockEl)

    try {
      await this.loadData()
      this.bindEvents()
      this.renderTagBar()
      this.renderTasks()
      this.updateGameUI()
      this.particles = new ParticleEngine(
        document.getElementById('particleCanvas') as HTMLCanvasElement,
        this.appEl()
      )
      this.startTaskTimerLoop()
      this.bindSettingsUpdate()
      initQuotes()
      new PomodoroTimer({
        onWorkComplete: () => this.onPomodoroComplete(),
        resizeToContent: () => this.resizeWindowToContent()
      })
      this.resizeWindowToContent()
    } catch (err) {
      console.error('Init failed', err)
      window.api.logError(`init failed: ${err instanceof Error ? err.stack || err.message : String(err)}`)
    }
  }

  private appEl(): HTMLElement {
    return document.getElementById('app') as HTMLElement
  }

  // ============ Data ============
  private async loadData(): Promise<void> {
    const [tasks, gameState, settings] = await Promise.all([
      window.api.listTasks(),
      window.api.getGameState(),
      window.api.getSettings()
    ])
    this.tasks = tasks
    this.settings = { ...DEFAULT_SETTINGS, ...settings }

    const merged = { ...defaultGameState(), ...gameState }
    const reset = resetTodayIfNeeded(merged)
    this.gameState = reset
    if (reset !== merged) await window.api.saveGameState(reset)
  }

  private async saveGameState(): Promise<void> {
    try {
      await window.api.saveGameState(this.gameState)
    } catch (err) {
      window.api.logError(`saveGameState failed: ${String(err)}`)
    }
  }

  // ============ Events ============
  private bindEvents(): void {
    const input = document.getElementById('taskInput') as HTMLInputElement
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        void this.addTask(input.value.trim())
        input.value = ''
      }
    })

    document.querySelectorAll<HTMLElement>('.priority-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.priority-btn').forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        this.currentPriority = (btn.dataset.priority as Priority) || 'normal'
      })
    })

    document.getElementById('btnCollapse')?.addEventListener('click', () => void this.toggleCollapse())
    document.getElementById('titlebar')?.addEventListener('dblclick', () => void this.toggleCollapse())

    document.getElementById('btnSettings')?.addEventListener('click', (e) => {
      e.stopPropagation()
      void window.api.openSettings()
    })
  }

  private bindSettingsUpdate(): void {
    window.api.onSettingsUpdated((newSettings) => {
      this.settings = { ...this.settings, ...newSettings }
      this.renderTagBar()
      this.renderTasks()
    })
  }

  // ============ Tag Bar（从设置动态渲染，v1 硬编码在 HTML） ============
  private renderTagBar(): void {
    const bar = document.getElementById('tagBar')
    if (!bar) return
    bar.innerHTML = ''

    const tags = ['', ...this.settings.tags]
    if (!tags.includes(this.currentTag)) this.currentTag = ''

    for (const tag of tags) {
      const chip = document.createElement('button')
      chip.className = 'tag-chip' + (tag === this.currentTag ? ' active' : '')
      chip.dataset.tag = tag
      chip.textContent = tag === '' ? '全部' : tag
      chip.addEventListener('click', () => {
        this.currentTag = tag
        bar.querySelectorAll('.tag-chip').forEach((c) => c.classList.remove('active'))
        chip.classList.add('active')
        this.renderTasks()
      })
      bar.appendChild(chip)
    }
  }

  // ============ Tasks ============
  private async addTask(text: string): Promise<void> {
    try {
      const task = await window.api.addTask({
        text,
        priority: this.currentPriority,
        tag: this.currentTag
      })
      this.tasks.unshift(task)
      this.renderTasks()
      this.resizeWindowToContent()

      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-id="${task.id}"]`)
        if (card) card.classList.add('task-enter')
      })
    } catch (err) {
      window.api.logError(`addTask failed: ${String(err)}`)
    }
  }

  private killTask(id: string): void {
    const card = document.querySelector<HTMLElement>(`[data-id="${id}"]`)
    const task = this.tasks.find((t) => t.id === id)
    if (!card || !task) return

    // ---- 打击感 ----
    if (this.settings.screenShake) {
      this.appEl().classList.add('screen-shake')
      window.setTimeout(() => this.appEl().classList.remove('screen-shake'), 300)
    }

    const rect = card.getBoundingClientRect()
    const appRect = this.appEl().getBoundingClientRect()
    this.particles.spawn(
      rect.left - appRect.left + rect.width / 2,
      rect.top - appRect.top + rect.height / 2,
      task.priority,
      this.settings.particleCount
    )
    card.classList.add('completing')

    // ---- 游戏结算（纯函数） ----
    const result = applyTaskCompletion(this.gameState, task.priority, this.settings)
    this.gameState = result.state

    this.showCombo(result.combo)
    if (result.leveledUp) this.showLevelUp(result.newLevel)
    for (const a of result.unlockedAchievements) {
      this.showAchievement(`${a.name}：${a.desc}`)
    }

    this.updateGameUI()
    void this.saveGameState()

    // ---- 动画结束后落库并移除 ----
    window.setTimeout(() => {
      void window.api
        .completeTask(id, result.xpGained)
        .catch((err) => window.api.logError(`completeTask failed: ${String(err)}`))
      this.tasks = this.tasks.filter((t) => t.id !== id)
      this.renderTasks()
      this.resizeWindowToContent()
    }, 500)
  }

  private deleteTask(id: string): void {
    void window.api
      .deleteTask(id)
      .catch((err) => window.api.logError(`deleteTask failed: ${String(err)}`))
    this.tasks = this.tasks.filter((t) => t.id !== id)
    this.renderTasks()
    this.resizeWindowToContent()
  }

  private async toggleTaskTimer(id: string): Promise<void> {
    try {
      const updated = await window.api.toggleTaskTimer(id)
      if (updated) {
        const idx = this.tasks.findIndex((t) => t.id === id)
        if (idx !== -1) this.tasks[idx] = updated
        this.renderTasks()
      }
    } catch (err) {
      window.api.logError(`toggleTaskTimer failed: ${String(err)}`)
    }
  }

  // ============ Render ============
  private renderTasks(): void {
    const list = document.getElementById('taskList')
    if (!list) return

    const filtered = this.currentTag
      ? this.tasks.filter((t) => t.tag === this.currentTag)
      : this.tasks

    list.innerHTML = ''
    if (filtered.length === 0) {
      list.appendChild(this.createEmptyState())
      return
    }

    for (const task of filtered) {
      list.appendChild(this.createTaskCard(task))
    }
    this.setupDragDrop()
  }

  private createEmptyState(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'empty-state'

    const icon = document.createElement('div')
    icon.className = 'empty-icon'
    icon.textContent = '🎮'
    const text = document.createElement('div')
    text.className = 'empty-text'
    text.textContent = '还没有任务'
    const sub = document.createElement('div')
    sub.className = 'empty-sub'
    sub.textContent = '输入任务开始你的冒险吧！'

    div.append(icon, text, sub)
    return div
  }

  private createTaskCard(task: Task): HTMLElement {
    const card = document.createElement('div')
    card.className = `task-card priority-${task.priority}`
    card.dataset.id = task.id
    card.draggable = true

    const ms = elapsedMs(task)
    const isRunning = task.timerStatus === 'running'

    // 全部用 DOM API 构建，任务文本不再经过 innerHTML（杜绝 XSS 风险面）
    const killBtn = document.createElement('button')
    killBtn.className = 'task-kill-btn'
    killBtn.title = '打掉！'
    killBtn.textContent = '⚡'
    killBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.killTask(task.id)
    })

    const content = document.createElement('div')
    content.className = 'task-content'

    const textDiv = document.createElement('div')
    textDiv.className = 'task-text'
    textDiv.textContent = task.text

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;'

    if (task.tag) {
      const tagDiv = document.createElement('div')
      tagDiv.className = 'task-tag'
      tagDiv.textContent = task.tag
      row.appendChild(tagDiv)
    }

    const timer = document.createElement('div')
    timer.className = `task-timer ${isRunning ? 'running' : 'paused'} ${timerColorClass(task, ms)}`
    timer.dataset.id = task.id

    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'timer-toggle-btn'
    toggleBtn.title = isRunning ? '暂停' : '开始'
    toggleBtn.textContent = isRunning ? '⏸' : '▶'
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      void this.toggleTaskTimer(task.id)
    })

    const timerIcon = document.createElement('span')
    timerIcon.className = 'timer-icon'
    timerIcon.textContent = '⏱'
    const timerText = document.createElement('span')
    timerText.className = 'timer-text'
    timerText.textContent = formatElapsed(ms)

    timer.append(toggleBtn, timerIcon, document.createTextNode(' '), timerText)
    row.appendChild(timer)
    content.append(textDiv, row)

    const actions = document.createElement('div')
    actions.className = 'task-actions'
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'task-action-btn'
    deleteBtn.title = '删除'
    deleteBtn.textContent = '✕'
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.deleteTask(task.id)
    })
    actions.appendChild(deleteBtn)

    card.append(killBtn, content, actions)
    return card
  }

  // ============ Drag & Drop ============
  private setupDragDrop(): void {
    const cards = document.querySelectorAll<HTMLElement>('.task-card')
    let draggedId: string | null = null

    cards.forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.id ?? null
        card.classList.add('dragging')
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      })

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging')
        document.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'))
      })

      card.addEventListener('dragover', (e) => {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
        card.classList.add('drag-over')
      })

      card.addEventListener('dragleave', () => card.classList.remove('drag-over'))

      card.addEventListener('drop', (e) => {
        e.preventDefault()
        card.classList.remove('drag-over')

        const targetId = card.dataset.id
        if (!draggedId || !targetId || draggedId === targetId) return

        const fromIdx = this.tasks.findIndex((t) => t.id === draggedId)
        const toIdx = this.tasks.findIndex((t) => t.id === targetId)
        if (fromIdx === -1 || toIdx === -1) return

        const [moved] = this.tasks.splice(fromIdx, 1)
        this.tasks.splice(toIdx, 0, moved)
        void window.api
          .reorderTasks(this.tasks.map((t) => t.id))
          .catch((err) => window.api.logError(`reorderTasks failed: ${String(err)}`))
        this.renderTasks()
      })
    })
  }

  // ============ Task Timer Loop ============
  private startTaskTimerLoop(): void {
    window.setInterval(() => {
      if (this.isCollapsed) return
      const now = Date.now()

      document.querySelectorAll<HTMLElement>('.task-timer').forEach((el) => {
        const task = this.tasks.find((t) => t.id === el.dataset.id)
        if (!task) return

        const ms = elapsedMs(task, now)
        const textEl = el.querySelector('.timer-text')
        if (textEl) textEl.textContent = formatElapsed(ms)

        el.classList.remove(...TIMER_COLOR_CLASSES)
        el.classList.add(timerColorClass(task, ms))
      })
    }, 1000)
  }

  // ============ Game UI ============
  private updateGameUI(): void {
    const xpPerLevel = this.settings.xpPerLevel
    const levelBadge = document.getElementById('levelBadge')
    if (levelBadge) levelBadge.textContent = `Lv.${this.gameState.level}`

    const xpInLevel = this.gameState.xp % xpPerLevel
    const xpFill = document.getElementById('xpFill')
    if (xpFill) xpFill.style.width = `${(xpInLevel / xpPerLevel) * 100}%`
    const xpText = document.getElementById('xpText')
    if (xpText) xpText.textContent = `${xpInLevel} / ${xpPerLevel} XP`

    const set = (id: string, value: number): void => {
      const el = document.getElementById(id)
      if (el) el.textContent = String(value)
    }
    set('statTotal', this.gameState.totalCompleted)
    set('statToday', this.gameState.todayCompleted)
    set('statStreak', this.gameState.combo)
  }

  private showCombo(count: number): void {
    if (count < 2) return
    const display = document.getElementById('comboDisplay')
    const countEl = document.getElementById('comboCount')
    if (!display || !countEl) return

    countEl.textContent = `${count}x`
    display.className = 'show'
    display.style.animation = 'none'
    requestAnimationFrame(() => {
      display.style.animation = ''
      display.className = 'show'
    })

    if (this.comboTimeout != null) window.clearTimeout(this.comboTimeout)
    this.comboTimeout = window.setTimeout(() => {
      display.className = 'hidden'
    }, 2500)
  }

  private showLevelUp(level: number): void {
    const overlay = document.getElementById('levelUpOverlay')
    const levelEl = document.getElementById('levelUpLevel')
    if (!overlay || !levelEl) return
    levelEl.textContent = `Lv.${level}`
    overlay.className = 'level-up-overlay show'
    window.setTimeout(() => {
      overlay.className = 'level-up-overlay hidden'
    }, 2500)
  }

  private showAchievement(text: string): void {
    const toast = document.getElementById('achievementToast')
    const textEl = document.getElementById('achievementText')
    if (!toast || !textEl) return
    textEl.textContent = text
    toast.className = 'achievement-toast show'
    window.setTimeout(() => {
      toast.className = 'achievement-toast hidden'
    }, 3200)
  }

  // ============ Pomodoro 完成回调 ============
  private onPomodoroComplete(): void {
    const result = applyPomodoroCompletion(this.gameState, this.settings)
    this.gameState = result.state
    if (result.leveledUp) this.showLevelUp(result.newLevel)
    this.updateGameUI()
    void this.saveGameState()
    this.showAchievement(`🍅 专注完成！+${POMODORO_XP_REWARD} XP`)
  }

  // ============ Collapse / Resize ============
  private async toggleCollapse(): Promise<void> {
    this.isCollapsed = !this.isCollapsed
    const app = this.appEl()
    const btn = document.getElementById('btnCollapse')

    if (this.isCollapsed) {
      app.classList.add('collapsed')
      if (btn) {
        btn.textContent = '□'
        btn.title = '展开'
      }
    } else {
      app.classList.remove('collapsed')
      if (btn) {
        btn.textContent = '─'
        btn.title = '折叠'
      }
    }

    try {
      await window.api.toggleCollapse(this.isCollapsed)
    } catch {
      /* 非 electron 环境忽略 */
    }
  }

  private resizeWindowToContent(): void {
    if (this.isCollapsed) return
    window.setTimeout(() => {
      const height = this.appEl().offsetHeight || this.appEl().scrollHeight
      if (height > 50) void window.api.resizeWindow(height)
    }, 100)
  }
}
