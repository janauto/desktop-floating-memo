import type { Task } from './types'

/** 计算任务当前累计耗时（含运行中的活动段） */
export function elapsedMs(task: Pick<Task, 'timerStatus' | 'lastStartTime' | 'accumulatedTime'>, now: number = Date.now()): number {
  let ms = task.accumulatedTime || 0
  if (task.timerStatus === 'running' && task.lastStartTime != null) {
    ms += Math.max(0, now - task.lastStartTime)
  }
  return ms
}

/** HH:MM:SS；超过 24 小时显示 "N天前"（沿用 v1 展示规则） */
export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** 耗时颜色分级（渲染层用 class 表达） */
export type TimerColorClass = 'paused-color' | 'running-color' | 'long-running-color' | 'very-long-color'

export function timerColorClass(task: Pick<Task, 'timerStatus'>, ms: number): TimerColorClass {
  if (task.timerStatus === 'paused') return 'paused-color'
  if (ms > 24 * 60 * 60 * 1000) return 'very-long-color'
  if (ms > 4 * 60 * 60 * 1000) return 'long-running-color'
  return 'running-color'
}

/** 暂停/恢复计时的纯逻辑（数据层应用其结果） */
export function toggleTimer(
  task: Pick<Task, 'timerStatus' | 'lastStartTime' | 'accumulatedTime'>,
  now: number = Date.now()
): { timerStatus: 'running' | 'paused'; lastStartTime: number | null; accumulatedTime: number } {
  if (task.timerStatus === 'running') {
    return {
      timerStatus: 'paused',
      lastStartTime: null,
      accumulatedTime: (task.accumulatedTime || 0) + Math.max(0, now - (task.lastStartTime ?? now))
    }
  }
  return {
    timerStatus: 'running',
    lastStartTime: now,
    accumulatedTime: task.accumulatedTime || 0
  }
}
