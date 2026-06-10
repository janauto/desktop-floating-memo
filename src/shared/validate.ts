/**
 * IPC 入参校验 — 渲染进程是不可信边界，主进程落库前必须校验/净化。
 */
import type { GameState, NewTaskInput, Priority, Settings } from './types'
import { DEFAULT_SETTINGS } from './constants'

const PRIORITIES: Priority[] = ['normal', 'important', 'urgent']

export const TASK_TEXT_MAX = 500
export const TAG_MAX = 30
export const TAGS_MAX_COUNT = 20

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(max, Math.max(min, n))
}

export function validateNewTask(input: unknown): NewTaskInput {
  if (!isRecord(input)) throw new ValidationError('task payload must be an object')
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (!text) throw new ValidationError('task text is required')
  const priority = PRIORITIES.includes(input.priority as Priority)
    ? (input.priority as Priority)
    : 'normal'
  const tag = typeof input.tag === 'string' ? input.tag.slice(0, TAG_MAX) : ''
  return { text: text.slice(0, TASK_TEXT_MAX), priority, tag }
}

export function validateId(id: unknown): string {
  if (typeof id !== 'string' || !id || id.length > 64) {
    throw new ValidationError('invalid task id')
  }
  return id
}

export function validateIdList(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length > 10000) throw new ValidationError('invalid id list')
  return ids.map(validateId)
}

export function validateXp(xp: unknown): number {
  return clampNumber(xp, 0, 100000, 0)
}

/** 设置项白名单 + 数值钳制：未知 key 直接丢弃 */
export function sanitizeSettings(input: unknown): Settings {
  const raw = isRecord(input) ? input : {}
  const d = DEFAULT_SETTINGS
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().slice(0, TAG_MAX))
        .filter(Boolean)
        .slice(0, TAGS_MAX_COUNT)
    : [...d.tags]
  return {
    comboWindow: clampNumber(raw.comboWindow, 1000, 60000, d.comboWindow),
    xpPerLevel: clampNumber(raw.xpPerLevel, 10, 10000, d.xpPerLevel),
    xpNormal: clampNumber(raw.xpNormal, 1, 1000, d.xpNormal),
    xpImportant: clampNumber(raw.xpImportant, 1, 1000, d.xpImportant),
    xpUrgent: clampNumber(raw.xpUrgent, 1, 1000, d.xpUrgent),
    blurOpacity: clampNumber(raw.blurOpacity, 0.1, 1, d.blurOpacity),
    alwaysOnTop: typeof raw.alwaysOnTop === 'boolean' ? raw.alwaysOnTop : d.alwaysOnTop,
    showClock: typeof raw.showClock === 'boolean' ? raw.showClock : d.showClock,
    showTaskTimer: typeof raw.showTaskTimer === 'boolean' ? raw.showTaskTimer : d.showTaskTimer,
    particleCount: clampNumber(raw.particleCount, 0, 200, d.particleCount),
    screenShake: typeof raw.screenShake === 'boolean' ? raw.screenShake : d.screenShake,
    tags
  }
}

export function sanitizeGameState(input: unknown, fallback: GameState): GameState {
  const raw = isRecord(input) ? input : {}
  return {
    xp: clampNumber(raw.xp, 0, Number.MAX_SAFE_INTEGER, fallback.xp),
    level: clampNumber(raw.level, 1, 100000, fallback.level),
    totalCompleted: clampNumber(raw.totalCompleted, 0, Number.MAX_SAFE_INTEGER, fallback.totalCompleted),
    todayCompleted: clampNumber(raw.todayCompleted, 0, Number.MAX_SAFE_INTEGER, fallback.todayCompleted),
    todayDate: typeof raw.todayDate === 'string' ? raw.todayDate.slice(0, 64) : fallback.todayDate,
    combo: clampNumber(raw.combo, 0, 100000, fallback.combo),
    lastKillTime: clampNumber(raw.lastKillTime, 0, Number.MAX_SAFE_INTEGER, fallback.lastKillTime),
    achievements: Array.isArray(raw.achievements)
      ? raw.achievements.filter((a): a is string => typeof a === 'string').slice(0, 100)
      : fallback.achievements
  }
}
