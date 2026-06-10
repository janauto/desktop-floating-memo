import { describe, expect, it } from 'vitest'
import {
  sanitizeSettings,
  validateId,
  validateNewTask,
  ValidationError
} from '../src/shared/validate'
import { DEFAULT_SETTINGS } from '../src/shared/constants'

describe('validateNewTask', () => {
  it('合法输入原样通过', () => {
    expect(validateNewTask({ text: '写周报', priority: 'urgent', tag: '需求' })).toEqual({
      text: '写周报',
      priority: 'urgent',
      tag: '需求'
    })
  })

  it('空文本抛错', () => {
    expect(() => validateNewTask({ text: '  ' })).toThrow(ValidationError)
    expect(() => validateNewTask(null)).toThrow(ValidationError)
  })

  it('非法优先级回退 normal，超长文本截断', () => {
    const result = validateNewTask({ text: 'a'.repeat(1000), priority: 'hacker' })
    expect(result.priority).toBe('normal')
    expect(result.text).toHaveLength(500)
  })
})

describe('validateId', () => {
  it('拒绝非字符串与超长 id', () => {
    expect(() => validateId(123)).toThrow(ValidationError)
    expect(() => validateId('')).toThrow(ValidationError)
    expect(() => validateId('x'.repeat(65))).toThrow(ValidationError)
    expect(validateId('abc-123')).toBe('abc-123')
  })
})

describe('sanitizeSettings', () => {
  it('未知 key 被丢弃，数值被钳制', () => {
    const result = sanitizeSettings({
      xpNormal: 99999,
      blurOpacity: -1,
      evil: 'payload',
      tags: ['ok', 42, '   ', 'x'.repeat(100)]
    })
    expect(result.xpNormal).toBe(1000)
    expect(result.blurOpacity).toBe(0.1)
    expect('evil' in result).toBe(false)
    expect(result.tags).toEqual(['ok', 'x'.repeat(30)])
  })

  it('非对象输入返回默认值', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })
})
