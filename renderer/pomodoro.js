/* ============================================
   番茄时钟 - Pomodoro Timer Module
   ============================================ */

class PomodoroTimer {
  constructor(app) {
    this.app = app; // reference to FloatingMemoApp

    // Timer config (minutes)
    this.durations = {
      work: 25,
      shortBreak: 5,
      longBreak: 15
    };

    // State
    this.mode = 'work'; // 'work' | 'shortBreak' | 'longBreak'
    this.isRunning = false;
    this.isPaused = false;
    this.totalSeconds = this.durations.work * 60;
    this.remainingSeconds = this.totalSeconds;
    this.timerInterval = null;
    this.currentSession = 1;
    this.maxSessions = 4;
    this.completedSessions = 0;
    this.isBodyVisible = true;

    // SVG ring
    this.ringCircumference = 2 * Math.PI * 52; // r=52

    // Audio context for notification
    this.audioCtx = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateDisplay();
    this.updateRing(1); // full ring at start
    this.updateSessionDots();
  }

  bindEvents() {
    // Mode tabs
    document.querySelectorAll('.pomo-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (this.isRunning) return; // don't switch while running
        this.setMode(tab.dataset.mode);
        document.querySelectorAll('.pomo-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });

    // Start/Pause button
    document.getElementById('pomoStartBtn').addEventListener('click', () => {
      if (this.isRunning) {
        this.pause();
      } else {
        this.start();
      }
    });

    // Reset button
    document.getElementById('pomoResetBtn').addEventListener('click', () => {
      this.reset();
    });

    // Skip button
    document.getElementById('pomoSkipBtn').addEventListener('click', () => {
      this.skip();
    });

    // Toggle body visibility
    document.getElementById('pomoToggleBtn').addEventListener('click', () => {
      this.toggleBody();
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.totalSeconds = this.durations[mode] * 60;
    this.remainingSeconds = this.totalSeconds;
    this.isRunning = false;
    this.isPaused = false;
    clearInterval(this.timerInterval);

    this.updateDisplay();
    this.updateRing(1);
    this.updateModeLabel();
    this.updateStartButton();
    this.updateRingGradient();
  }

  start() {
    if (this.isRunning && !this.isPaused) return;

    this.isRunning = true;
    this.isPaused = false;
    this.updateStartButton();

    // Add pulse animation to ring
    const section = document.getElementById('pomodoroSection');
    section.classList.add('pomo-active');

    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;

      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = 0;
        this.complete();
        return;
      }

      this.updateDisplay();
      const progress = this.remainingSeconds / this.totalSeconds;
      this.updateRing(progress);
    }, 1000);
  }

  pause() {
    this.isPaused = true;
    this.isRunning = false;
    clearInterval(this.timerInterval);
    this.updateStartButton();

    const section = document.getElementById('pomodoroSection');
    section.classList.remove('pomo-active');
  }

  reset() {
    clearInterval(this.timerInterval);
    this.isRunning = false;
    this.isPaused = false;
    this.remainingSeconds = this.totalSeconds;

    this.updateDisplay();
    this.updateRing(1);
    this.updateStartButton();

    const section = document.getElementById('pomodoroSection');
    section.classList.remove('pomo-active');
  }

  skip() {
    clearInterval(this.timerInterval);
    this.isRunning = false;
    this.isPaused = false;

    const section = document.getElementById('pomodoroSection');
    section.classList.remove('pomo-active');

    this.advanceToNext();
  }

  complete() {
    clearInterval(this.timerInterval);
    this.isRunning = false;
    this.isPaused = false;

    const section = document.getElementById('pomodoroSection');
    section.classList.remove('pomo-active');

    // Play notification sound
    this.playNotificationSound();

    // Flash animation
    section.classList.add('pomo-complete-flash');
    setTimeout(() => section.classList.remove('pomo-complete-flash'), 1500);

    // Award XP for completing a work session
    if (this.mode === 'work') {
      this.completedSessions++;
      if (this.app) {
        const xpReward = 15;
        this.app.gameState.xp += xpReward;
        
        // Level up check
        const newLevel = Math.floor(this.app.gameState.xp / this.app.XP_PER_LEVEL) + 1;
        if (newLevel > this.app.gameState.level) {
          this.app.gameState.level = newLevel;
          this.app.showLevelUp(newLevel);
        }
        this.app.updateGameUI();
        this.app.saveData();

        // Show achievement-style toast
        this.app.showAchievement(`🍅 专注完成！+${xpReward} XP`);
      }
    }

    this.updateSessionDots();
    
    // Auto-advance after a brief delay
    setTimeout(() => this.advanceToNext(), 2000);
  }

  advanceToNext() {
    if (this.mode === 'work') {
      // After work, go to break
      if (this.currentSession >= this.maxSessions) {
        // Long break after max sessions
        this.currentSession = 1;
        this.completedSessions = 0;
        this.setMode('longBreak');
        this.activateTab('longBreak');
      } else {
        this.currentSession++;
        this.setMode('shortBreak');
        this.activateTab('shortBreak');
      }
    } else {
      // After break, go to work
      this.setMode('work');
      this.activateTab('work');
    }
    this.updateSessionDots();
  }

  activateTab(mode) {
    document.querySelectorAll('.pomo-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
  }

  toggleBody() {
    const body = document.getElementById('pomoBody');
    const btn = document.getElementById('pomoToggleBtn');
    this.isBodyVisible = !this.isBodyVisible;

    if (this.isBodyVisible) {
      body.style.maxHeight = '300px';
      body.style.opacity = '1';
      body.style.padding = '12px 14px 8px';
      btn.textContent = '▾';
      btn.style.transform = 'rotate(0deg)';
    } else {
      body.style.maxHeight = '0';
      body.style.opacity = '0';
      body.style.padding = '0 14px';
      btn.textContent = '▸';
      btn.style.transform = 'rotate(-90deg)';
    }

    // Resize window after animation
    setTimeout(() => {
      if (this.app) this.app.resizeWindowToContent();
    }, 350);
  }

  // ============ Display Updates ============
  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('pomoTime').textContent = timeStr;
  }

  updateRing(progress) {
    const circle = document.getElementById('pomoRingProgress');
    if (!circle) return;

    const offset = this.ringCircumference * (1 - progress);
    circle.style.strokeDasharray = `${this.ringCircumference}`;
    circle.style.strokeDashoffset = `${offset}`;
  }

  updateRingGradient() {
    const circle = document.getElementById('pomoRingProgress');
    if (!circle) return;

    if (this.mode === 'work') {
      circle.setAttribute('stroke', 'url(#pomoGrad)');
    } else {
      circle.setAttribute('stroke', 'url(#pomoGradBreak)');
    }
  }

  updateModeLabel() {
    const label = document.getElementById('pomoModeLabel');
    const labels = {
      work: '专注模式',
      shortBreak: '短暂休息',
      longBreak: '长时休息'
    };
    label.textContent = labels[this.mode] || '专注模式';
  }

  updateStartButton() {
    const icon = document.getElementById('pomoStartIcon');
    const btn = document.getElementById('pomoStartBtn');

    if (this.isRunning) {
      icon.textContent = '⏸';
      btn.title = '暂停';
      btn.classList.add('running');
    } else {
      icon.textContent = '▶';
      btn.title = this.isPaused ? '继续' : '开始';
      btn.classList.remove('running');
    }
  }

  updateSessionDots() {
    const container = document.getElementById('pomoSessions');
    const textEl = document.getElementById('pomoSessionText');
    
    container.innerHTML = '';
    for (let i = 0; i < this.maxSessions; i++) {
      const dot = document.createElement('span');
      dot.className = 'pomo-dot';
      if (i < this.completedSessions) {
        dot.classList.add('completed');
      } else if (i === this.completedSessions && this.mode === 'work') {
        dot.classList.add('current');
      }
      container.appendChild(dot);
    }

    textEl.textContent = `第 ${Math.min(this.completedSessions + 1, this.maxSessions)}/${this.maxSessions} 轮`;
  }

  // ============ Sound ============
  playNotificationSound() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.audioCtx;

      // Play a pleasant chime sequence
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const now = ctx.currentTime;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.7);
      });

      // Additional resonant bell
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = 880;
        gain2.gain.setValueAtTime(0.2, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 1.5);
      }, 600);
    } catch (e) {
      console.warn('Audio notification failed:', e);
    }
  }

  // Cleanup
  destroy() {
    clearInterval(this.timerInterval);
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
    }
  }
}
