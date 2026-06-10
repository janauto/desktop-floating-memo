/** 浮窗底部语录区：30 分钟轮换，点击手动刷新 */
import { getRandomQuote } from '@shared/quotes'

const ROTATE_INTERVAL = 30 * 60 * 1000

export function initQuotes(): void {
  const textEl = document.getElementById('quoteText')
  const authorEl = document.getElementById('quoteAuthor')
  const areaEl = document.getElementById('quoteArea')
  if (!textEl || !authorEl || !areaEl) return

  const show = (): void => {
    const quote = getRandomQuote()
    areaEl.style.opacity = '0'
    window.setTimeout(() => {
      textEl.textContent = `“${quote.text}”`
      authorEl.textContent = `—— ${quote.author}`
      areaEl.style.opacity = '1'
    }, 500)
  }

  show()
  window.setInterval(show, ROTATE_INTERVAL)
  areaEl.addEventListener('click', show)
}
