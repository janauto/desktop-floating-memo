/**
 * 番茄时钟 — 与主应用解耦：完成专注轮次时通过 host 回调通知，
 * 不再直接修改 app 的游戏状态（v1 中 pomodoro 直接改 app.gameState）。
 */
export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak'

export interface PomodoroHost {
  /** 一轮专注完成（用于发放 XP、弹提示） */
  onWorkComplete: () => void
  /** 收起/展开后需要重新计算窗口高度 */
  resizeToContent: () => void
}

const DURATIONS: Record<PomodoroMode, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
}

const MODE_LABELS: Record<PomodoroMode, string> = {
  work: '专注模式',
  shortBreak: '短暂休息',
  longBreak: '长时休息'
}

export class PomodoroTimer {
  private mode: PomodoroMode = 'work'
  private isRunning = false
  private isPaused = false
  private totalSeconds = DURATIONS.work
  private remainingSeconds = DURATIONS.work
  private timerInterval: number | null = null
  private currentSession = 1
  private readonly maxSessions = 4
  private completedSessions = 0
  private isBodyVisible = true
  private readonly ringCircumference = 2 * Math.PI * 52
  private audioCtx: AudioContext | null = null

  constructor(private readonly host: PomodoroHost) {
    this.bindEvents()
    this.updateDisplay()
    this.updateRing(1)
    this.updateSessionDots()
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T {
    const node = document.getElementById(id)
    if (!node) throw new Error(`pomodoro element #${id} not found`)
    return node as T
  }

  private bindEvents(): void {
    document.querySelectorAll<HTMLElement>('.pomo-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        if (this.isRunning) return
        this.setMode((tab.dataset.mode as PomodoroMode) || 'work')
        this.activateTab(this.mode)
      })
    })

    this.el('pomoStartBtn').addEventListener('click', () => {
      if (this.isRunning) this.pause()
      else this.start()
    })
    this.el('pomoResetBtn').addEventListener('click', () => this.reset())
    this.el('pomoSkipBtn').addEventListener('click', () => this.skip())
    this.el('pomoToggleBtn').addEventListener('click', () => this.toggleBody())
  }

  private setMode(mode: PomodoroMode): void {
    this.mode = mode
    this.totalSeconds = DURATIONS[mode]
    this.remainingSeconds = this.totalSeconds
    this.isRunning = false
    this.isPaused = false
    this.clearTimer()

    this.updateDisplay()
    this.updateRing(1)
    this.updateModeLabel()
    this.updateStartButton()
    this.updateRingGradient()
  }

  private start(): void {
    if (this.isRunning && !this.isPaused) return
    this.isRunning = true
    this.isPaused = false
    this.updateStartButton()
    this.el('pomodoroSection').classList.add('pomo-active')

    this.timerInterval = window.setInterval(() => {
      this.remainingSeconds--
      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = 0
        this.complete()
        return
      }
      this.updateDisplay()
      this.updateRing(this.remainingSeconds / this.totalSeconds)
    }, 1000)
  }

  private pause(): void {
    this.isPaused = true
    this.isRunning = false
    this.clearTimer()
    this.updateStartButton()
    this.el('pomodoroSection').classList.remove('pomo-active')
  }

  private reset(): void {
    this.clearTimer()
    this.isRunning = false
    this.isPaused = false
    this.remainingSeconds = this.totalSeconds
    this.updateDisplay()
    this.updateRing(1)
    this.updateStartButton()
    this.el('pomodoroSection').classList.remove('pomo-active')
  }

  private skip(): void {
    this.clearTimer()
    this.isRunning = false
    this.isPaused = false
    this.el('pomodoroSection').classList.remove('pomo-active')
    this.advanceToNext()
  }

  private complete(): void {
    this.clearTimer()
    this.isRunning = false
    this.isPaused = false

    const section = this.el('pomodoroSection')
    section.classList.remove('pomo-active')

    this.playNotificationSound()
    section.classList.add('pomo-complete-flash')
    window.setTimeout(() => section.classList.remove('pomo-complete-flash'), 1500)

    if (this.mode === 'work') {
      this.completedSessions++
      this.host.onWorkComplete()
    }

    this.updateSessionDots()
    window.setTimeout(() => this.advanceToNext(), 2000)
  }

  private advanceToNext(): void {
    if (this.mode === 'work') {
      if (this.currentSession >= this.maxSessions) {
        this.currentSession = 1
        this.completedSessions = 0
        this.setMode('longBreak')
      } else {
        this.currentSession++
        this.setMode('shortBreak')
      }
    } else {
      this.setMode('work')
    }
    this.activateTab(this.mode)
    this.updateSessionDots()
  }

  private activateTab(mode: PomodoroMode): void {
    document.querySelectorAll<HTMLElement>('.pomo-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.mode === mode)
    })
  }

  private toggleBody(): void {
    const body = this.el('pomoBody')
    const btn = this.el('pomoToggleBtn')
    this.isBodyVisible = !this.isBodyVisible

    if (this.isBodyVisible) {
      body.style.maxHeight = '300px'
      body.style.opacity = '1'
      body.style.padding = '12px 14px 8px'
      btn.textContent = '▾'
      btn.style.transform = 'rotate(0deg)'
    } else {
      body.style.maxHeight = '0'
      body.style.opacity = '0'
      body.style.padding = '0 14px'
      btn.textContent = '▸'
      btn.style.transform = 'rotate(-90deg)'
    }

    window.setTimeout(() => this.host.resizeToContent(), 350)
  }

  // ---- Display ----
  private updateDisplay(): void {
    const mins = Math.floor(this.remainingSeconds / 60)
    const secs = this.remainingSeconds % 60
    const pad = (n: number) => n.toString().padStart(2, '0')
    this.el('pomoTime').textContent = `${pad(mins)}:${pad(secs)}`
  }

  private updateRing(progress: number): void {
    const circle = document.getElementById('pomoRingProgress')
    if (!circle) return
    const offset = this.ringCircumference * (1 - progress)
    circle.style.strokeDasharray = `${this.ringCircumference}`
    circle.style.strokeDashoffset = `${offset}`
  }

  private updateRingGradient(): void {
    const circle = document.getElementById('pomoRingProgress')
    if (!circle) return
    circle.setAttribute('stroke', this.mode === 'work' ? 'url(#pomoGrad)' : 'url(#pomoGradBreak)')
  }

  private updateModeLabel(): void {
    this.el('pomoModeLabel').textContent = MODE_LABELS[this.mode]
  }

  private updateStartButton(): void {
    const icon = this.el('pomoStartIcon')
    const btn = this.el('pomoStartBtn')
    if (this.isRunning) {
      icon.textContent = '⏸'
      btn.title = '暂停'
      btn.classList.add('running')
    } else {
      icon.textContent = '▶'
      btn.title = this.isPaused ? '继续' : '开始'
      btn.classList.remove('running')
    }
  }

  private updateSessionDots(): void {
    const container = this.el('pomoSessions')
    const textEl = this.el('pomoSessionText')

    container.innerHTML = ''
    for (let i = 0; i < this.maxSessions; i++) {
      const dot = document.createElement('span')
      dot.className = 'pomo-dot'
      if (i < this.completedSessions) dot.classList.add('completed')
      else if (i === this.completedSessions && this.mode === 'work') dot.classList.add('current')
      container.appendChild(dot)
    }

    textEl.textContent = `第 ${Math.min(this.completedSessions + 1, this.maxSessions)}/${this.maxSessions} 轮`
  }

  private clearTimer(): void {
    if (this.timerInterval != null) {
      window.clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  // ---- Sound ----
  private playNotificationSound(): void {
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext()
      const ctx = this.audioCtx
      const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
      const now = ctx.currentTime

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, now + i * 0.15)
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.6)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.15)
        osc.stop(now + i * 0.15 + 0.7)
      })

      window.setTimeout(() => {
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'triangle'
        osc2.frequency.value = 880
        gain2.gain.setValueAtTime(0.2, ctx.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start()
        osc2.stop(ctx.currentTime + 1.5)
      }, 600)
    } catch (err) {
      console.warn('Audio notification failed:', err)
    }
  }
}
