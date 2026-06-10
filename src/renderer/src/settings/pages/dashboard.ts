/** 看板分析页 */
import type { Stats } from '@shared/types'
import { getRandomQuote } from '@shared/quotes'
import { escapeHtml } from '../controls'

let quoteTimer: number | null = null

export async function renderDashboard(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="page-title">看板分析</div>
    <div id="dashboardLoading" style="text-align:center; padding:40px; color:var(--accent-cyan); opacity:0.6;">
      ⌛ 正在加载同步数据...
    </div>
  `

  let stats: Stats = {
    totalCompleted: 0,
    todayCompleted: 0,
    weekCompleted: 0,
    totalCreated: 0,
    totalDeleted: 0,
    avgTimeMs: 0,
    totalXp: 0,
    byPriority: [],
    byTag: [],
    hourCounts: new Array(24).fill(0),
    dailyStats: [],
    completionRate: 0
  }

  try {
    stats = await window.api.getStats()
  } catch (err) {
    container.insertAdjacentHTML(
      'beforeend',
      `<div style="color:var(--accent-red); background:rgba(255,0,0,0.1); padding:10px; border-radius:4px; margin-bottom:20px;">
        ⚠️ 数据加载失败: ${escapeHtml(err instanceof Error ? err.message : String(err))}
      </div>`
    )
  }

  document.getElementById('dashboardLoading')?.remove()

  // 统计卡片
  container.insertAdjacentHTML(
    'beforeend',
    `<div class="stat-cards">
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--accent-cyan)">🏁</div>
        <div class="stat-info">
          <div class="stat-num">${stats.todayCompleted}</div>
          <div class="stat-label">今日完成</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--accent-purple)">📅</div>
        <div class="stat-info">
          <div class="stat-num">${stats.weekCompleted}</div>
          <div class="stat-label">本周完成</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--accent-green)">🎯</div>
        <div class="stat-info">
          <div class="stat-num">${stats.completionRate}%</div>
          <div class="stat-label">完成率</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="color:var(--accent-yellow)">⭐</div>
        <div class="stat-info">
          <div class="stat-num">${stats.totalXp}</div>
          <div class="stat-label">累计经验</div>
        </div>
      </div>
    </div>`
  )

  // 图表
  const maxHourly = Math.max(...stats.hourCounts, 1)
  const heatmapBars = stats.hourCounts
    .map((val, i) => {
      const h = (val / maxHourly) * 100
      return `<div class="heatmap-bar" style="height: ${Math.max(10, h)}%" data-val="${i}点:${val}次"></div>`
    })
    .join('')

  const maxDaily = Math.max(...stats.dailyStats.map((x) => x.count), 1)
  const dailyItems = stats.dailyStats
    .map((d) => {
      const h = Math.min(100, (d.count / maxDaily) * 100)
      return `
        <div class="trend-item">
          <div class="trend-bar" style="height:${Math.max(5, h)}%" title="${d.date}: ${d.count}个"></div>
          <div class="trend-label">${d.weekday}</div>
        </div>`
    })
    .join('')

  container.insertAdjacentHTML(
    'beforeend',
    `<div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">活跃时间段 (24小时分布)</div>
        <div class="heatmap-container">${heatmapBars}</div>
      </div>
      <div class="chart-container">
        <div class="chart-title">最近7日趋势 (完成数)</div>
        <div class="trend-container">${dailyItems}</div>
      </div>
    </div>`
  )

  // 效率诊断
  let efficiencyText = '保持良好的工作节奏，继续加油。'
  if (stats.todayCompleted === 0) {
    efficiencyText = '千里之行，始于足下。先挑选一个最简单的任务（2分钟内能做完的），建立动量。'
  } else if (stats.completionRate < 30) {
    efficiencyText = '建议将大任务拆分为更小的子任务，使用番茄工作法（25分钟工作+5分钟休息）来提升执行力。'
  } else if (stats.avgTimeMs > 4 * 3600 * 1000) {
    efficiencyText = '平均单个任务耗时较长。尝试在开始前明确任务边界，避免过度陷入细节（帕累托法则）。'
  } else if (stats.todayCompleted > 10) {
    efficiencyText = '今日效率惊人！但也请注意劳逸结合，深度工作比浅层次的忙碌更有价值。'
  }

  container.insertAdjacentHTML(
    'beforeend',
    `<div class="analysis-card">
      <div class="analysis-title">✨ 效率诊断</div>
      <div class="analysis-content">${efficiencyText}</div>
    </div>`
  )

  renderQuote(container)
}

function renderQuote(container: HTMLElement): void {
  const q = getRandomQuote()
  container.insertAdjacentHTML(
    'beforeend',
    `<div class="quote-bar" id="quoteBar">
      <div class="quote-text" id="quoteText">"${escapeHtml(q.text)}"</div>
      <div class="quote-author" id="quoteAuthor">- ${escapeHtml(q.author)}</div>
    </div>`
  )
}

export function startQuoteTimer(): void {
  if (quoteTimer != null) window.clearInterval(quoteTimer)
  quoteTimer = window.setInterval(() => {
    const qt = document.getElementById('quoteText')
    const qa = document.getElementById('quoteAuthor')
    const qb = document.getElementById('quoteBar')
    if (qt && qa) {
      const q = getRandomQuote()
      if (qb) qb.style.opacity = '0'
      window.setTimeout(() => {
        qt.textContent = `"${q.text}"`
        qa.textContent = `- ${q.author}`
        if (qb) qb.style.opacity = '1'
      }, 1000)
    }
  }, 5 * 60 * 1000)
}
