/** 主窗口入口 */
import { FloatingMemoApp } from './app'

window.addEventListener('error', (e) => {
  window.api?.logError(`window error: ${e.message} @ ${e.filename}:${e.lineno}`)
})
window.addEventListener('unhandledrejection', (e) => {
  window.api?.logError(`unhandled rejection: ${String(e.reason)}`)
})

document.addEventListener('DOMContentLoaded', () => {
  void new FloatingMemoApp().init()
})
