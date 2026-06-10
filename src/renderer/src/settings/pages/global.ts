/** 全局设置页：游戏化参数 + 视图效果 */
import { bindCheckbox, bindRange } from '../controls'
import { state } from '../state'

export function renderGlobalSettings(container: HTMLElement): void {
  const s = state.settings
  container.innerHTML = `
    <div class="page-title">全局设置</div>
    <div class="settings-group">
      <div class="settings-group-title">游戏化参数</div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">普通任务经验值</div>
          <div class="setting-desc">默认 10 XP</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-xpNormal">${s.xpNormal}</span>
          <input type="range" id="inp-xpNormal" min="5" max="50" step="1" value="${s.xpNormal}">
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">重要任务经验值</div>
          <div class="setting-desc">默认 20 XP</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-xpImportant">${s.xpImportant}</span>
          <input type="range" id="inp-xpImportant" min="10" max="100" step="5" value="${s.xpImportant}">
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">紧急任务经验值</div>
          <div class="setting-desc">默认 30 XP</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-xpUrgent">${s.xpUrgent}</span>
          <input type="range" id="inp-xpUrgent" min="15" max="150" step="5" value="${s.xpUrgent}">
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">连击判定时间 (毫秒)</div>
          <div class="setting-desc">短时间内连续完成任务可获得加成</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-combo">${s.comboWindow}</span>
          <input type="range" id="inp-combo" min="2000" max="15000" step="1000" value="${s.comboWindow}">
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">视图与效果</div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">始终置顶</div>
          <div class="setting-desc">主窗口永远显示在最前面</div>
        </div>
        <div class="setting-control">
          <label class="switch">
            <input type="checkbox" id="inp-top" ${s.alwaysOnTop ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">屏幕震动</div>
          <div class="setting-desc">打掉任务时的打击感效果</div>
        </div>
        <div class="setting-control">
          <label class="switch">
            <input type="checkbox" id="inp-shake" ${s.screenShake ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>
  `

  bindRange('inp-xpNormal', 'val-xpNormal', 'xpNormal')
  bindRange('inp-xpImportant', 'val-xpImportant', 'xpImportant')
  bindRange('inp-xpUrgent', 'val-xpUrgent', 'xpUrgent')
  bindRange('inp-combo', 'val-combo', 'comboWindow')
  bindCheckbox('inp-top', 'alwaysOnTop')
  bindCheckbox('inp-shake', 'screenShake')
}
