/** 个性化页：外观 + 标签管理 */
import { bindRange, escapeHtml } from '../controls'
import { saveSettings, state } from '../state'

export function renderPersonalSettings(container: HTMLElement): void {
  const s = state.settings
  const tagsHtml = s.tags
    .map(
      (t, i) => `
      <div class="edit-tag-chip">
        ${escapeHtml(t)} <span class="remove-tag" data-idx="${i}">✕</span>
      </div>`
    )
    .join('')

  container.innerHTML = `
    <div class="page-title">个性化</div>
    <div class="settings-group">
      <div class="settings-group-title">外观设置</div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">失焦透明度</div>
          <div class="setting-desc">主窗口未激活时的透明程度</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-blur">${s.blurOpacity.toFixed(2)}</span>
          <input type="range" id="inp-blur" min="0.1" max="1.0" step="0.05" value="${s.blurOpacity}">
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">标签管理</div>
      <div class="tag-editor" id="tagList">
        ${tagsHtml}
        <input type="text" id="newTagInput" class="add-tag-input" placeholder="+ 添加新标签 (回车)">
      </div>
    </div>
  `

  bindRange('inp-blur', 'val-blur', 'blurOpacity', true)

  const tagList = document.getElementById('tagList')
  tagList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('remove-tag')) {
      const idx = parseInt(target.dataset.idx ?? '', 10)
      if (!Number.isNaN(idx)) {
        s.tags.splice(idx, 1)
        saveSettings()
        renderPersonalSettings(container)
      }
    }
  })

  const newTagInput = document.getElementById('newTagInput') as HTMLInputElement | null
  newTagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = newTagInput.value.trim()
      if (v && !s.tags.includes(v)) {
        s.tags.push(v)
        saveSettings()
        renderPersonalSettings(container)
      }
    }
  })
}
