/** 设置窗口入口：侧边栏路由 */
import { loadSettings } from './state'
import { renderDashboard, startQuoteTimer } from './pages/dashboard'
import { renderGlobalSettings } from './pages/global'
import { renderPersonalSettings } from './pages/personal'
import { renderTerminal } from './pages/terminal'

type Page = 'dashboard' | 'global' | 'personal' | 'terminal'

async function switchPage(page: Page): Promise<void> {
  const content = document.getElementById('contentArea')
  if (!content) return
  content.innerHTML = ''

  switch (page) {
    case 'dashboard':
      await renderDashboard(content)
      break
    case 'global':
      renderGlobalSettings(content)
      break
    case 'personal':
      renderPersonalSettings(content)
      break
    case 'terminal':
      renderTerminal(content)
      break
  }
}

async function init(): Promise<void> {
  await loadSettings()

  document.getElementById('btnClose')?.addEventListener('click', () => {
    void window.api.closeSettings()
  })

  document.getElementById('btnMax')?.addEventListener('click', (e) => {
    e.stopPropagation()
    void window.api.toggleSettingsFullscreen()
  })

  document.querySelectorAll<HTMLElement>('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'))
      item.classList.add('active')
      void switchPage((item.dataset.page as Page) || 'dashboard')
    })
  })

  startQuoteTimer()
  await switchPage('dashboard')
}

window.addEventListener('error', (e) => {
  window.api?.logError(`settings window error: ${e.message}`)
})

void init()
