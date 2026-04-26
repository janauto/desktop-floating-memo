let settings = {};
let currentQuoteIdx = -1;
let quoteTimer = null;

async function init() {
  if (window.api && window.api.getSettings) {
    settings = await window.api.getSettings();
  }
  
  // Bind simple buttons
  document.getElementById('btnClose').addEventListener('click', () => {
    if (window.api && window.api.closeSettings) window.api.closeSettings();
  });
  
  const btnMax = document.getElementById('btnMax');
  if (btnMax) {
    btnMax.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.api && window.api.toggleSettingsFullscreen) {
        await window.api.toggleSettingsFullscreen();
      }
    });
  }

  // Sidebar routing
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      switchPage(item.dataset.page);
    });
  });

  // Initial render
  startQuoteTimer();
  switchPage('dashboard');
}

async function switchPage(page) {
  const content = document.getElementById('contentArea');
  content.innerHTML = ''; // Clear

  switch(page) {
    case 'dashboard':
      await renderDashboard(content);
      break;
    case 'global':
      renderGlobalSettings(content);
      break;
    case 'personal':
      renderPersonalSettings(content);
      break;
    case 'terminal':
      renderTerminal(content);
      break;
  }
}

/* ====================================
   DASHBOARD
==================================== */
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-title">看板分析</div>
    <div id="dashboardLoading" style="text-align:center; padding:40px; color:var(--accent-cyan); opacity:0.6;">
      ⌛ 正在加载同步数据...
    </div>
  `;
  
  let stats = {
    todayCompleted: 0,
    weekCompleted: 0,
    completionRate: 0,
    totalXp: 0,
    dailyStats: [],
    hourCounts: [],
    avgTimeMs: 0
  };

  try {
    if (window.api && window.api.dbGetStats) {
      stats = await window.api.dbGetStats();
    }
  } catch (err) {
    console.error('Failed to get stats:', err);
    container.insertAdjacentHTML('beforeend', `
      <div style="color:var(--accent-red); background:rgba(255,0,0,0.1); padding:10px; border-radius:4px; margin-bottom:20px;">
        ⚠️ 数据加载失败: ${err.message}
      </div>
    `);
  }

  // Remove loading
  const loadingEl = document.getElementById('dashboardLoading');
  if (loadingEl) loadingEl.remove();

  // 1. Cards
  const cardsHtml = `
    <div class="stat-cards">
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
    </div>
  `;
  container.insertAdjacentHTML('beforeend', cardsHtml);

  // 2. Charts (Heatmap & Trend)
  let maxHourly = Math.max(...(stats.hourCounts || [0]), 1);
  const heatmapBars = (stats.hourCounts || new Array(24).fill(0)).map((val, i) => {
    const h = (val / maxHourly) * 100;
    return `<div class="heatmap-bar" style="height: ${Math.max(10, h)}%" data-val="${i}点:${val}次"></div>`;
  }).join('');

  const dailyItems = (stats.dailyStats || []).map(d => {
    const maxVal = Math.max(...stats.dailyStats.map(x => x.count), 1);
    const h = Math.min(100, (d.count / maxVal) * 100);
    return `
      <div class="trend-item">
        <div class="trend-bar" style="height:${Math.max(5, h)}%" title="${d.date}: ${d.count}个"></div>
        <div class="trend-label">${d.weekday}</div>
      </div>
    `;
  }).join('');

  const chartsHtml = `
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">活跃时间段 (24小时分布)</div>
        <div class="heatmap-container">${heatmapBars}</div>
      </div>
      <div class="chart-container">
        <div class="chart-title">最近7日趋势 (完成数)</div>
        <div class="trend-container">${dailyItems}</div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', chartsHtml);

  // 3. Efficiency Analysis
  let efficiencyText = '保持良好的工作节奏，继续加油。';
  if (stats.todayCompleted === 0) {
    efficiencyText = '千里之行，始于足下。先挑选一个最简单的任务（2分钟内能做完的），建立动量。';
  } else if (stats.completionRate < 30) {
    efficiencyText = '建议将大任务拆分为更小的子任务，使用番茄工作法（25分钟工作+5分钟休息）来提升执行力。';
  } else if (stats.avgTimeMs > 4 * 3600 * 1000) {
    efficiencyText = '平均单个任务耗时较长。尝试在开始前明确任务边界，避免过度陷入细节（帕累托法则）。';
  } else if (stats.todayCompleted > 10) {
    efficiencyText = '今日效率惊人！但也请注意劳逸结合，深度工作比浅层次的忙碌更有价值。';
  }

  const analysisHtml = `
    <div class="analysis-card">
      <div class="analysis-title">✨ AI 效率诊断</div>
      <div class="analysis-content">${efficiencyText}</div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', analysisHtml);

  // 4. Quote
  renderQuote(container);
}

function renderQuote(container) {
  let q = { text: '...', author: ' ' };
  if (typeof getRandomQuote === 'function') {
    q = getRandomQuote();
  }
  
  const quoteHtml = `
    <div class="quote-bar" id="quoteBar">
      <div class="quote-text" id="quoteText">"${q.text}"</div>
      <div class="quote-author" id="quoteAuthor">- ${q.author}</div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', quoteHtml);
}

function startQuoteTimer() {
  if (quoteTimer) clearInterval(quoteTimer);
  // Change quote every 5 mins
  quoteTimer = setInterval(() => {
    const qt = document.getElementById('quoteText');
    const qa = document.getElementById('quoteAuthor');
    const qb = document.getElementById('quoteBar');
    if (qt && qa && typeof getRandomQuote === 'function') {
      const q = getRandomQuote();
      if (qb) qb.style.opacity = 0;
      setTimeout(() => {
        if (qt) qt.textContent = `"${q.text}"`;
        if (qa) qa.textContent = `- ${q.author}`;
        if (qb) qb.style.opacity = 1;
      }, 1000);
    }
  }, 5 * 60 * 1000);
}


/* ====================================
   GLOBAL SETTINGS
==================================== */
function renderGlobalSettings(container) {
  container.innerHTML = `<div class="page-title">全局设置</div>`;
  
  const html = `
    <div class="settings-group">
      <div class="settings-group-title">游戏化参数</div>
      
      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">普通任务经验值</div>
          <div class="setting-desc">默认 10 XP</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-xpNormal">${settings.xpNormal || 10}</span>
          <input type="range" id="inp-xpNormal" min="5" max="50" step="1" value="${settings.xpNormal || 10}">
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">重要任务经验值</div>
          <div class="setting-desc">默认 20 XP</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-xpImportant">${settings.xpImportant || 20}</span>
          <input type="range" id="inp-xpImportant" min="10" max="100" step="5" value="${settings.xpImportant || 20}">
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">紧急任务经验值</div>
          <div class="setting-desc">默认 30 XP</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-xpUrgent">${settings.xpUrgent || 30}</span>
          <input type="range" id="inp-xpUrgent" min="15" max="150" step="5" value="${settings.xpUrgent || 30}">
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">连击判定时间 (毫秒)</div>
          <div class="setting-desc">短时间内连续完成任务可获得加成</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-combo">${settings.comboWindow || 5000}</span>
          <input type="range" id="inp-combo" min="2000" max="15000" step="1000" value="${settings.comboWindow || 5000}">
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
            <input type="checkbox" id="inp-top" ${settings.alwaysOnTop ? 'checked' : ''}>
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
            <input type="checkbox" id="inp-shake" ${settings.screenShake ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);

  // Bind events
  bindRange('inp-xpNormal', 'val-xpNormal', 'xpNormal');
  bindRange('inp-xpImportant', 'val-xpImportant', 'xpImportant');
  bindRange('inp-xpUrgent', 'val-xpUrgent', 'xpUrgent');
  bindRange('inp-combo', 'val-combo', 'comboWindow');
  bindCheckbox('inp-top', 'alwaysOnTop');
  bindCheckbox('inp-shake', 'screenShake');
}

/* ====================================
   PERSONAL
==================================== */
function renderPersonalSettings(container) {
  container.innerHTML = `<div class="page-title">个性化</div>`;
  
  const tagsHtml = (settings.tags || []).map((t, i) => `
    <div class="edit-tag-chip">
      ${escapeHtml(t)} <span class="remove-tag" data-idx="${i}">✕</span>
    </div>
  `).join('');

  const html = `
    <div class="settings-group">
      <div class="settings-group-title">外观设置</div>

      <div class="setting-item">
        <div class="setting-label">
          <div class="setting-name">失焦透明度</div>
          <div class="setting-desc">主窗口未激活时的透明程度</div>
        </div>
        <div class="setting-control">
          <span class="range-val" id="val-blur">${(settings.blurOpacity || 0.55).toFixed(2)}</span>
          <input type="range" id="inp-blur" min="0.1" max="1.0" step="0.05" value="${settings.blurOpacity || 0.55}">
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
  `;
  container.insertAdjacentHTML('beforeend', html);

  bindRange('inp-blur', 'val-blur', 'blurOpacity', true);

  // Tags logic
  const tagList = document.getElementById('tagList');
  tagList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-tag')) {
      const idx = parseInt(e.target.dataset.idx, 10);
      settings.tags.splice(idx, 1);
      saveAndRenderPersonal(container);
    }
  });

  const newTagInput = document.getElementById('newTagInput');
  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = newTagInput.value.trim();
      if (v && !settings.tags.includes(v)) {
        settings.tags.push(v);
        saveAndRenderPersonal(container);
      }
    }
  });
}

function saveAndRenderPersonal(container) {
  saveSettings();
  renderPersonalSettings(container); // re-render
}


/* ====================================
   TERMINAL
==================================== */
function renderTerminal(container) {
  container.innerHTML = `
    <div class="terminal-wrapper">
      <div class="term-body" id="termBody">
        <div class="boot-sequence">
          <p>MEMO_OS v1.0.0 initializing...</p>
          <p>Loading database module... [OK]</p>
          <p>Mounting game logic... [OK]</p>
          <p>Type <span class="highlight">help</span> for available commands.</p>
        </div>
        <div id="termOutput"></div>
        <div class="term-input-line">
          <span class="prompt">admin@memo:~$</span>
          <input type="text" id="termInput" autocomplete="off" spellcheck="false" autofocus>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('termInput');
  const output = document.getElementById('termOutput');
  const body = document.getElementById('termBody');

  container.addEventListener('click', () => {
    input.focus();
  });

  function termPrintLine(html) {
    const p = document.createElement('div');
    p.className = 'term-line';
    p.innerHTML = html;
    output.appendChild(p);
    body.scrollTop = body.scrollHeight;
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      input.value = '';
      termPrintLine(`<span class="prompt">admin@memo:~$</span> ${escapeHtml(val)}`);
      if (val) {
        await processCommand(val, termPrintLine, output);
      }
    }
  });
  
  // Auto focus after a short delay since it might take a tick to render
  setTimeout(() => input.focus(), 50);
}

async function processCommand(cmdStr, printLine, outputContainer) {
  const regex = /[^\s"]+|"([^"]*)"/g;
  const args = [];
  let match;
  while ((match = regex.exec(cmdStr)) !== null) {
      args.push(match[1] ? match[1] : match[0]);
  }

  if (args.length === 0) return;
  const cmd = args[0].toLowerCase();

  switch(cmd) {
    case 'help':
      printLine(`AVAILABLE COMMANDS:
  <span class="cmd-name">help</span>      - Show this help message
  <span class="cmd-name">list</span>      - List all current configuration parameters
  <span class="cmd-name">get</span>       - Get a specific parameter (e.g., get xpNormal)
  <span class="cmd-name">set</span>       - Set parameter (e.g., set xpNormal 20)
  <span class="cmd-name">clear</span>     - Clear terminal screen
  <span class="cmd-name">exit</span>      - Close the terminal session`);
      break;
    case 'clear':
      outputContainer.innerHTML = '';
      break;
    case 'exit':
      if (window.api) window.api.closeSettings();
      break;
    case 'list':
      let out = 'CURRENT SYSTEM PARAMETERS:<br>';
      for (const [k, v] of Object.entries(settings)) {
        out += `  <span class="param-key">${k}</span> = <span class="param-val">${JSON.stringify(v)}</span><br>`;
      }
      printLine(out);
      break;
    case 'get':
      if (args.length < 2) {
        printLine('<span class="error">Error: Usage: get [key]</span>');
        return;
      }
      const gkey = args[1];
      if (settings[gkey] !== undefined) {
         printLine(`  <span class="param-key">${gkey}</span> = <span class="param-val">${JSON.stringify(settings[gkey])}</span>`);
      } else {
         printLine(`<span class="error">Error: Key '${gkey}' not found.</span>`);
      }
      break;
    case 'set':
      if (args.length < 3) {
        printLine('<span class="error">Error: Usage: set [key] [value]</span>');
        return;
      }
      const key = args[1];
      const val = args.slice(2).join(' ');
      if (settings[key] !== undefined) {
        let typeofVal = typeof settings[key];
        let parsedVal = val;
        
        try {
          if (typeofVal === 'number') {
            parsedVal = Number(val);
            if (isNaN(parsedVal)) throw new Error('Must be a number');
          } else if (typeofVal === 'boolean') {
            if (val === 'true') parsedVal = true;
            else if (val === 'false') parsedVal = false;
            else throw new Error('Must be true or false');
          } else if (typeofVal === 'object') {
             try { parsedVal = JSON.parse(val); } 
             catch(e) { parsedVal = val.split(',').map(s => s.trim()); }
          }
          settings[key] = parsedVal;
          saveSettings();
          printLine(`<span class="success">Success: Parameter '${key}' dynamically updated to ${JSON.stringify(parsedVal)}</span>`);
        } catch (e) {
             printLine(`<span class="error">Parse Error: ${e.message}</span>`);
        }
      } else {
        printLine(`<span class="error">Error: Configuration key '${key}' not found.</span>`);
      }
      break;
    default:
      printLine(`<span class="error">Command not found: ${escapeHtml(cmd)}</span>`);
  }
}

/* ====================================
   HELPERS & BINDINGS
==================================== */
function bindRange(inputId, valId, key, isFloat = false) {
  const inp = document.getElementById(inputId);
  const valSpan = document.getElementById(valId);
  if (!inp || !valSpan) return;

  inp.addEventListener('input', () => {
    valSpan.textContent = inp.value;
  });

  inp.addEventListener('change', () => {
    settings[key] = isFloat ? parseFloat(inp.value) : parseInt(inp.value, 10);
    saveSettings();
  });
}

function bindCheckbox(inputId, key) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.addEventListener('change', () => {
    settings[key] = inp.checked;
    saveSettings();
  });
}

function saveSettings() {
  if (window.api && window.api.saveSettings) {
    window.api.saveSettings(settings);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start
init();
