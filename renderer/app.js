/* ============================================
   桌面浮窗备忘录 - 核心应用逻辑
   ============================================ */

class FloatingMemoApp {
  constructor() {
    this.tasks = [];
    this.gameState = {
      xp: 0,
      level: 1,
      totalCompleted: 0,
      todayCompleted: 0,
      todayDate: new Date().toDateString(),
      combo: 0,
      lastKillTime: 0,
      achievements: []
    };
    this.currentPriority = 'normal';
    this.currentTag = '';
    this.isCollapsed = false;
    this.comboTimeout = null;
    this.settings = {
      comboWindow: 5000,
      xpNormal: 10,
      xpImportant: 20,
      xpUrgent: 30,
      blurOpacity: 0.55,
      screenShake: true
    };
    this.XP_PER_LEVEL = 100;
    this.timers = [];
    this.clockInterval = null;
    this.quoteInterval = null;

    this.init();
  }

  async init() {
    this.startClock(); // Start immediately
    try {
      await this.loadData();
      this.resetTodayIfNeeded();
      this.bindEvents();
      this.renderTasks();
      this.updateGameUI();
      this.initParticleCanvas();
      this.startTaskTimers();
      this.bindSettingsUpdate();
      this.initQuotes();
      this.initPomodoro();
      this.resizeWindowToContent();
    } catch (e) {
      console.error('Init failed', e);
    }
  }

  resizeWindowToContent() {
    if (!window.api || !window.api.resizeWindow || this.isCollapsed) return;
    
    // Calculate required height based on content
    setTimeout(() => {
      const appContent = document.getElementById('app');
      if (appContent) {
        // Measure real scrollHeight after a brief render delay
        const height = appContent.offsetHeight || appContent.scrollHeight;
        if (height > 50) { // Safety check
          window.api.resizeWindow(height);
        }
      }
    }, 100);
  }

  // ============ Data ============
  async loadData() {
    try {
      this.tasks = await window.api.getTasks() || [];
      const savedState = await window.api.getGameState();
      if (savedState) {
        this.gameState = { ...this.gameState, ...savedState };
      }
      const savedSettings = await window.api.getSettings();
      if (savedSettings) {
        this.settings = { ...this.settings, ...savedSettings };
      }
    } catch (e) {
      console.log('Using local storage fallback');
      this.tasks = JSON.parse(localStorage.getItem('memo_tasks') || '[]');
      const saved = JSON.parse(localStorage.getItem('memo_gameState') || 'null');
      if (saved) this.gameState = { ...this.gameState, ...saved };
    }
  }

  async saveData() {
    try {
      await window.api.saveTasks(this.tasks);
      await window.api.saveGameState(this.gameState);
    } catch (e) {
      localStorage.setItem('memo_tasks', JSON.stringify(this.tasks));
      localStorage.setItem('memo_gameState', JSON.stringify(this.gameState));
    }
  }

  resetTodayIfNeeded() {
    const today = new Date().toDateString();
    if (this.gameState.todayDate !== today) {
      this.gameState.todayCompleted = 0;
      this.gameState.todayDate = today;
      this.gameState.combo = 0;
    }
  }

  // ============ Events ============
  bindEvents() {
    // Task input
    const input = document.getElementById('taskInput');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        this.addTask(input.value.trim());
        input.value = '';
      }
    });

    // Priority buttons
    document.querySelectorAll('.priority-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPriority = btn.dataset.priority;
      });
    });

    // Tags chips
    document.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentTag = chip.dataset.tag;
        this.renderTasks();
      });
    });

    // Collapse button
    document.getElementById('btnCollapse').addEventListener('click', () => {
      this.toggleCollapse();
    });

    // Double-click titlebar to collapse
    document.getElementById('titlebar').addEventListener('dblclick', () => {
      this.toggleCollapse();
    });

    // Settings Button
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent drag or collapse
        if (window.api && window.api.openSettings) {
          window.api.openSettings();
        }
      });
    }

    // Quote refresh on click
    const quoteArea = document.getElementById('quoteArea');
    if (quoteArea) {
      quoteArea.addEventListener('click', () => {
        this.updateQuoteDisplay();
      });
    }
  }

  bindSettingsUpdate() {
    if (window.api && window.api.onSettingsUpdated) {
      window.api.onSettingsUpdated((newSettings) => {
        this.settings = { ...this.settings, ...newSettings };
        this.renderTasks();
      });
    }
  }

  // ============ Tasks ============
  async addTask(text) {
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text,
      priority: this.currentPriority,
      tag: this.getTagFromButtons(),
      createdAt: Date.now(),
      completed: false,
      timerStatus: 'running',
      lastStartTime: Date.now(),
      accumulatedTime: 0
    };

    this.tasks.unshift(task);
    await this.saveData();
    // Record to database
    if (window.api && window.api.dbAddRecord) {
      window.api.dbAddRecord(task).catch(() => {});
    }
    this.renderTasks();
    this.resizeWindowToContent();

    // Animate new card
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-id="${task.id}"]`);
      if (card) card.classList.add('task-enter');
    });
  }

  getTagFromButtons() {
    // If a specific tag is selected (not "All"), use it for new tasks
    const activeTag = document.querySelector('.tag-chip.active');
    return activeTag ? activeTag.dataset.tag : '';
  }

  killTask(id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (!card) return;

    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    // ---- Screen shake ----
    if (this.settings.screenShake) {
      document.getElementById('app').classList.add('screen-shake');
      setTimeout(() => document.getElementById('app').classList.remove('screen-shake'), 300);
    }

    // ---- Particle explosion ----
    const rect = card.getBoundingClientRect();
    const appRect = document.getElementById('app').getBoundingClientRect();
    const x = rect.left - appRect.left + rect.width / 2;
    const y = rect.top - appRect.top + rect.height / 2;
    this.spawnParticles(x, y, task.priority);

    // ---- Card kill animation ----
    card.classList.add('completing');

    // ---- XP & Game State ----
    const xpGain = this.settings[`xp${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`] || 10;
    this.gameState.xp += xpGain;
    this.gameState.totalCompleted++;
    this.gameState.todayCompleted++;

    // ---- Combo system ----
    const now = Date.now();
    if (now - this.gameState.lastKillTime < (this.settings.comboWindow || 5000)) {
      this.gameState.combo++;
      // Bonus XP for combo
      this.gameState.xp += Math.floor(this.gameState.combo * 5);
    } else {
      this.gameState.combo = 1;
    }
    this.gameState.lastKillTime = now;
    this.showCombo(this.gameState.combo);

    // ---- Level up check ----
    const newLevel = Math.floor(this.gameState.xp / this.XP_PER_LEVEL) + 1;
    if (newLevel > this.gameState.level) {
      this.gameState.level = newLevel;
      this.showLevelUp(newLevel);
    }

    // ---- Achievement check ----
    this.checkAchievements();

    // ---- Update UI ----
    this.updateGameUI();
    this.saveData();

    // ---- Remove task after animation ----
    setTimeout(() => {
      // Record completion to database
      if (window.api && window.api.dbCompleteRecord) {
        const completedTask = this.tasks.find(t => t.id === id);
        const accTime = completedTask ? (completedTask.accumulatedTime || 0) : 0;
        window.api.dbCompleteRecord(id, accTime, xpGain).catch(() => {});
      }
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.saveData();
      this.renderTasks();
      this.resizeWindowToContent();
    }, 500);
  }

  deleteTask(id) {
    // Record deletion to database
    if (window.api && window.api.dbDeleteRecord) {
      window.api.dbDeleteRecord(id).catch(() => {});
    }
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveData();
    this.renderTasks();
    this.resizeWindowToContent();
  }

  // ============ Render ============
  renderTasks() {
    const list = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');

    const filtered = this.currentTag
      ? this.tasks.filter(t => t.tag === this.currentTag)
      : this.tasks;

    if (filtered.length === 0) {
      list.innerHTML = '';
      list.appendChild(this.createEmptyState());
      return;
    }

    list.innerHTML = '';
    filtered.forEach(task => {
      list.appendChild(this.createTaskCard(task));
    });

    // Setup drag and drop
    this.setupDragDrop();
  }

  createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <div class="empty-icon">🎮</div>
      <div class="empty-text">还没有任务</div>
      <div class="empty-sub">输入任务开始你的冒险吧！</div>
    `;
    return div;
  }

  createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority}`;
    card.dataset.id = task.id;
    card.draggable = true;

    // Backward compatibility
    if (task.timerStatus === undefined) {
      task.timerStatus = 'running';
      task.lastStartTime = task.createdAt || Date.now();
      task.accumulatedTime = 0;
    }

    const tagHtml = task.tag ? `<div class="task-tag">${task.tag}</div>` : '';

    let currentElapsed = task.accumulatedTime || 0;
    if (task.timerStatus === 'running') {
      currentElapsed += (Date.now() - (task.lastStartTime || Date.now()));
    }
    const initialTimeStr = this.formatElapsed(currentElapsed);
    const isRunning = task.timerStatus === 'running';

    card.innerHTML = `
      <button class="task-kill-btn" title="打掉！">⚡</button>
      <div class="task-content">
        <div class="task-text">${this.escapeHtml(task.text)}</div>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          ${tagHtml}
          <div class="task-timer ${isRunning ? 'running' : 'paused'}" data-id="${task.id}">
            <button class="timer-toggle-btn" title="${isRunning ? '暂停' : '开始'}">${isRunning ? '⏸' : '▶'}</button>
            <span class="timer-icon">⏱</span> <span class="timer-text">${initialTimeStr}</span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn" data-action="delete" title="删除">✕</button>
      </div>
    `;

    // Timer play/pause toggle
    const toggleBtn = card.querySelector('.timer-toggle-btn');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTaskTimer(task.id);
    });

    // Kill button
    card.querySelector('.task-kill-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.killTask(task.id);
    });

    // Delete button
    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteTask(task.id);
    });

    return card;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============ Drag & Drop ============
  setupDragDrop() {
    const cards = document.querySelectorAll('.task-card');
    let draggedId = null;

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');

        const targetId = card.dataset.id;
        if (draggedId && draggedId !== targetId) {
          const fromIdx = this.tasks.findIndex(t => t.id === draggedId);
          const toIdx = this.tasks.findIndex(t => t.id === targetId);
          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = this.tasks.splice(fromIdx, 1);
            this.tasks.splice(toIdx, 0, moved);
            this.saveData();
            this.renderTasks();
          }
        }
      });
    });
  }

  // ============ Clocks & Timers ============
  startClock() {
    const clockEl = document.getElementById('liveClock');
    if (!clockEl) return;

    const updateClock = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const s = now.getSeconds().toString().padStart(2, '0');
      clockEl.textContent = `${h}:${m}:${s}`;
    };

    updateClock();
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(updateClock, 1000);
  }

  toggleTaskTimer(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    if (task.timerStatus === 'running') {
      task.timerStatus = 'paused';
      task.accumulatedTime += (Date.now() - task.lastStartTime);
    } else {
      task.timerStatus = 'running';
      task.lastStartTime = Date.now();
    }
    this.saveData();
    this.renderTasks();
  }

  startTaskTimers() {
    // Clear old interval if exists
    if (this.taskTimerInterval) clearInterval(this.taskTimerInterval);

    this.taskTimerInterval = setInterval(() => {
      if (this.isCollapsed) return; // Don't update if hidden

      const timerEls = document.querySelectorAll('.task-timer');
      const now = Date.now();

      timerEls.forEach(el => {
        const id = el.dataset.id;
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        let elapsedMs = task.accumulatedTime || 0;
        if (task.timerStatus === 'running') {
          elapsedMs += (now - (task.lastStartTime || now));
        }

        const textEl = el.querySelector('.timer-text');
        if (textEl) {
          textEl.textContent = this.formatElapsed(elapsedMs);
        }

        // Color coding based on time
        el.classList.remove('running-color', 'long-running-color', 'very-long-color', 'paused-color');
        if (task.timerStatus === 'paused') {
          el.classList.add('paused-color');
        } else {
          if (elapsedMs > 24 * 60 * 60 * 1000) {
            el.classList.add('very-long-color'); // > 24 hours
          } else if (elapsedMs > 4 * 60 * 60 * 1000) {
            el.classList.add('long-running-color'); // > 4 hours
          } else {
            el.classList.add('running-color'); // < 4 hours
          }
        }
      });
    }, 1000); // UI update every second
  }

  formatElapsed(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}天前`;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // ============ Game UI ============
  updateGameUI() {
    // Level
    document.getElementById('levelBadge').textContent = `Lv.${this.gameState.level}`;

    // XP Bar
    const xpInLevel = this.gameState.xp % this.XP_PER_LEVEL;
    const percent = (xpInLevel / this.XP_PER_LEVEL) * 100;
    document.getElementById('xpFill').style.width = `${percent}%`;
    document.getElementById('xpText').textContent = `${xpInLevel} / ${this.XP_PER_LEVEL} XP`;

    // Stats
    document.getElementById('statTotal').textContent = this.gameState.totalCompleted;
    document.getElementById('statToday').textContent = this.gameState.todayCompleted;
    document.getElementById('statStreak').textContent = this.gameState.combo;
  }

  showCombo(count) {
    if (count < 2) return;

    const display = document.getElementById('comboDisplay');
    const countEl = document.getElementById('comboCount');
    countEl.textContent = `${count}x`;

    display.className = 'show';
    display.style.animation = 'none';
    requestAnimationFrame(() => {
      display.style.animation = '';
      display.className = 'show';
    });

    // Auto-hide
    clearTimeout(this.comboTimeout);
    this.comboTimeout = setTimeout(() => {
      display.className = 'hidden';
    }, 2500);
  }

  showLevelUp(level) {
    const overlay = document.getElementById('levelUpOverlay');
    document.getElementById('levelUpLevel').textContent = `Lv.${level}`;
    overlay.className = 'level-up-overlay show';

    setTimeout(() => {
      overlay.className = 'level-up-overlay hidden';
    }, 2500);
  }

  // ============ Achievements ============
  checkAchievements() {
    const achievements = [
      { id: 'first_kill', name: '初次出击', desc: '完成第一个任务', check: () => this.gameState.totalCompleted >= 1 },
      { id: 'ten_kills', name: '小试牛刀', desc: '完成 10 个任务', check: () => this.gameState.totalCompleted >= 10 },
      { id: 'fifty_kills', name: '效率达人', desc: '完成 50 个任务', check: () => this.gameState.totalCompleted >= 50 },
      { id: 'hundred_kills', name: '任务终结者', desc: '完成 100 个任务', check: () => this.gameState.totalCompleted >= 100 },
      { id: 'combo_3', name: '三连击', desc: '达成 3 连击', check: () => this.gameState.combo >= 3 },
      { id: 'combo_5', name: '五杀！', desc: '达成 5 连击', check: () => this.gameState.combo >= 5 },
      { id: 'combo_10', name: '无人能挡', desc: '达成 10 连击', check: () => this.gameState.combo >= 10 },
      { id: 'level_5', name: '崭露头角', desc: '达到 5 级', check: () => this.gameState.level >= 5 },
      { id: 'level_10', name: '久经沙场', desc: '达到 10 级', check: () => this.gameState.level >= 10 },
    ];

    for (const achievement of achievements) {
      if (!this.gameState.achievements.includes(achievement.id) && achievement.check()) {
        this.gameState.achievements.push(achievement.id);
        this.showAchievement(`${achievement.name}：${achievement.desc}`);
        // Bonus XP
        this.gameState.xp += 50;
        break; // Show one at a time
      }
    }
  }

  showAchievement(text) {
    const toast = document.getElementById('achievementToast');
    document.getElementById('achievementText').textContent = text;
    toast.className = 'achievement-toast show';

    setTimeout(() => {
      toast.className = 'achievement-toast hidden';
    }, 3200);
  }

  // ============ Collapse ============
  async toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    const app = document.getElementById('app');
    const btn = document.getElementById('btnCollapse');

    if (this.isCollapsed) {
      app.classList.add('collapsed');
      btn.textContent = '□';
      btn.title = '展开';
    } else {
      app.classList.remove('collapsed');
      btn.textContent = '─';
      btn.title = '折叠';
    }

    try {
      await window.api.toggleCollapse(this.isCollapsed);
    } catch (e) {
      // Fallback for non-electron
    }
  }

  // ============ Particles ============
  initParticleCanvas() {
    this.canvas = document.getElementById('particleCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.resizeCanvas();

    // Observe resize
    const observer = new ResizeObserver(() => this.resizeCanvas());
    observer.observe(document.getElementById('app'));

    this.animateParticles();
  }

  resizeCanvas() {
    const app = document.getElementById('app');
    this.canvas.width = app.offsetWidth;
    this.canvas.height = app.offsetHeight;
  }

  spawnParticles(x, y, priority) {
    const colors = {
      urgent: ['#f87171', '#fbbf24', '#ff6b6b', '#ff4757'],
      important: ['#fbbf24', '#f59e0b', '#fcd34d', '#ff9f43'],
      normal: ['#34d399', '#22d3ee', '#8b5cf6', '#6366f1']
    };

    const palette = colors[priority] || colors.normal;
    const count = 24;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 5;
      const size = 2 + Math.random() * 4;

      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        gravity: 0.08,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      });
    }

    // Add spark trails
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5,
        color: '#ffffff',
        life: 1,
        decay: 0.03 + Math.random() * 0.02,
        gravity: 0.04,
        shape: 'circle'
      });
    }
  }

  animateParticles() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        const s = p.size * p.life;
        this.ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }

    this.ctx.globalAlpha = 1;
    requestAnimationFrame(() => this.animateParticles());
  }

  // ============ Pomodoro ============
  initPomodoro() {
    if (typeof PomodoroTimer === 'function') {
      this.pomodoro = new PomodoroTimer(this);
    }
  }

  // ============ Quotes ============
  initQuotes() {
    this.updateQuoteDisplay();
    // Change quote every 30 minutes
    if (this.quoteInterval) clearInterval(this.quoteInterval);
    this.quoteInterval = setInterval(() => this.updateQuoteDisplay(), 30 * 60 * 1000);
  }

  updateQuoteDisplay() {
    const textEl = document.getElementById('quoteText');
    const authorEl = document.getElementById('quoteAuthor');
    const areaEl = document.getElementById('quoteArea');

    if (!textEl || !authorEl || typeof getRandomQuote !== 'function') return;

    const quote = getRandomQuote();
    
    // Smooth transition
    if (areaEl) areaEl.style.opacity = '0';
    
    setTimeout(() => {
      textEl.textContent = `“${quote.text}”`;
      authorEl.textContent = `—— ${quote.author}`;
      if (areaEl) areaEl.style.opacity = '1';
    }, 500);
  }
}

// ============ Launch ============
document.addEventListener('DOMContentLoaded', () => {
  new FloatingMemoApp();
});
