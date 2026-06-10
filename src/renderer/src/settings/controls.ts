/** 设置页通用控件绑定 */
import type { Settings } from '@shared/types'
import { saveSettings, state } from './state'

type NumberKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never
}[keyof Settings]

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never
}[keyof Settings]

export function bindRange(inputId: string, valId: string, key: NumberKey, isFloat = false): void {
  const inp = document.getElementById(inputId) as HTMLInputElement | null
  const valSpan = document.getElementById(valId)
  if (!inp || !valSpan) return

  inp.addEventListener('input', () => {
    valSpan.textContent = inp.value
  })

  inp.addEventListener('change', () => {
    state.settings[key] = isFloat ? parseFloat(inp.value) : parseInt(inp.value, 10)
    saveSettings()
  })
}

export function bindCheckbox(inputId: string, key: BooleanKey): void {
  const inp = document.getElementById(inputId) as HTMLInputElement | null
  if (!inp) return
  inp.addEventListener('change', () => {
    state.settings[key] = inp.checked
    saveSettings()
  })
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
