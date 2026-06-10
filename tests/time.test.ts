import { describe, expect, it } from 'vitest'
import { elapsedMs, formatElapsed, timerColorClass, toggleTimer } from '../src/shared/time'

describe('elapsedMs', () => {
  it('暂停状态只算累计时间', () => {
    expect(elapsedMs({ timerStatus: 'paused', lastStartTime: null, accumulatedTime: 5000 }, 99999)).toBe(5000)
  })

  it('运行状态加上活动段', () => {
    expect(elapsedMs({ timerStatus: 'running', lastStartTime: 1000, accumulatedTime: 5000 }, 3000)).toBe(7000)
  })

  it('时钟回拨不产生负数', () => {
    expect(elapsedMs({ timerStatus: 'running', lastStartTime: 5000, accumulatedTime: 100 }, 3000)).toBe(100)
  })
})

describe('formatElapsed', () => {
  it('格式化为 HH:MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00:00')
    expect(formatElapsed(61_000)).toBe('00:01:01')
    expect(formatElapsed(3_661_000)).toBe('01:01:01')
  })

  it('负数按 0 处理', () => {
    expect(formatElapsed(-5)).toBe('00:00:00')
  })

  it('超过 24 小时显示天数', () => {
    expect(formatElapsed(25 * 3600 * 1000)).toBe('1天前')
    expect(formatElapsed(49 * 3600 * 1000)).toBe('2天前')
  })
})

describe('timerColorClass', () => {
  it('暂停态返回 paused-color', () => {
    expect(timerColorClass({ timerStatus: 'paused' }, 0)).toBe('paused-color')
  })

  it('按耗时分级', () => {
    expect(timerColorClass({ timerStatus: 'running' }, 1000)).toBe('running-color')
    expect(timerColorClass({ timerStatus: 'running' }, 5 * 3600 * 1000)).toBe('long-running-color')
    expect(timerColorClass({ timerStatus: 'running' }, 25 * 3600 * 1000)).toBe('very-long-color')
  })
})

describe('toggleTimer', () => {
  it('运行 → 暂停：结算活动段到累计时间', () => {
    const result = toggleTimer({ timerStatus: 'running', lastStartTime: 1000, accumulatedTime: 500 }, 4000)
    expect(result.timerStatus).toBe('paused')
    expect(result.accumulatedTime).toBe(3500)
    expect(result.lastStartTime).toBeNull()
  })

  it('暂停 → 运行：记录新起点，累计时间不变', () => {
    const result = toggleTimer({ timerStatus: 'paused', lastStartTime: null, accumulatedTime: 500 }, 4000)
    expect(result.timerStatus).toBe('running')
    expect(result.accumulatedTime).toBe(500)
    expect(result.lastStartTime).toBe(4000)
  })
})
