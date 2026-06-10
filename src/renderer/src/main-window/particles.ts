/**
 * 粒子特效引擎 — 任务完成时的爆炸效果。
 * 改进：粒子数量从设置读取（v1 写死 24）；无粒子时暂停 rAF 循环省电。
 */
import type { Priority } from '@shared/types'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  decay: number
  gravity: number
  shape: 'circle' | 'square'
}

const PALETTES: Record<Priority, string[]> = {
  urgent: ['#f87171', '#fbbf24', '#ff6b6b', '#ff4757'],
  important: ['#fbbf24', '#f59e0b', '#fcd34d', '#ff9f43'],
  normal: ['#34d399', '#22d3ee', '#8b5cf6', '#6366f1']
}

export class ParticleEngine {
  private readonly ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private animating = false

  constructor(
    private readonly canvas: HTMLCanvasElement,
    observeTarget: HTMLElement
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    this.ctx = ctx

    this.resize(observeTarget)
    new ResizeObserver(() => this.resize(observeTarget)).observe(observeTarget)
  }

  private resize(target: HTMLElement): void {
    this.canvas.width = target.offsetWidth
    this.canvas.height = target.offsetHeight
  }

  spawn(x: number, y: number, priority: Priority, count: number): void {
    const palette = PALETTES[priority] ?? PALETTES.normal

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 2 + Math.random() * 5
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        gravity: 0.08,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      })
    }

    // 白色火花尾迹
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 3
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5,
        color: '#ffffff',
        life: 1,
        decay: 0.03 + Math.random() * 0.02,
        gravity: 0.04,
        shape: 'circle'
      })
    }

    if (!this.animating) {
      this.animating = true
      requestAnimationFrame(() => this.tick())
    }
  }

  private tick(): void {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += p.gravity
      p.vx *= 0.98
      p.life -= p.decay

      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }

      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const s = p.size * p.life
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
      }
    }

    ctx.globalAlpha = 1

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.tick())
    } else {
      this.animating = false
    }
  }
}
