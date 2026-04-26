const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
const db = require('./db');

const store = new Store({
  defaults: {
    tasks: [],
    gameState: {
      xp: 0,
      level: 1,
      totalCompleted: 0,
      achievements: []
    },
    windowBounds: { x: undefined, y: undefined, width: 380, height: 560 },
    settings: {
      comboWindow: 5000,
      xpPerLevel: 100,
      xpNormal: 10,
      xpImportant: 20,
      xpUrgent: 30,
      blurOpacity: 0.55,
      alwaysOnTop: true,
      showClock: true,
      showTaskTimer: true,
      particleCount: 24,
      screenShake: true,
      tags: ['需求', '会议', '💡想法', '🐛Bug']
    }
  }
});

let mainWindow;
let settingsWindow = null;
let tray;
let isCollapsed = false;
const COLLAPSED_HEIGHT = 48;
const EXPANDED_HEIGHT = 560;

function createWindow() {
  const bounds = store.get('windowBounds');
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: bounds.width || 380,
    height: bounds.height || EXPANDED_HEIGHT,
    x: bounds.x !== undefined ? bounds.x : screenWidth - 400,
    y: bounds.y !== undefined ? bounds.y : 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true, // Allow programmatic size changes and user adjustment
    skipTaskbar: true,
    hasShadow: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Save window position on move
  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    store.set('windowBounds.x', x);
    store.set('windowBounds.y', y);
  });

  // Opacity effect
  mainWindow.on('blur', () => {
    if (!isCollapsed) {
      mainWindow.setOpacity(0.55);
    }
  });

  mainWindow.on('focus', () => {
    mainWindow.setOpacity(1.0);
  });

  // Mouse enter/leave for opacity
  mainWindow.on('mouse-enter', () => {
    mainWindow.setOpacity(1.0);
  });
}

function createTray() {
  // Create a simple tray icon programmatically
  const iconSize = 16;
  const canvas = nativeImage.createEmpty();
  
  // Use a template image for macOS
  const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(trayIconPath);
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
    trayIcon.setTemplateImage(true);
  } catch (e) {
    // Fallback: create a simple icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('浮窗备忘录');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.setOpacity(1.0);
        }
      }
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        mainWindow.setAlwaysOnTop(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
      mainWindow.setOpacity(1.0);
    }
  });
}

// IPC Handlers
ipcMain.handle('get-tasks', () => {
  return store.get('tasks');
});

ipcMain.handle('save-tasks', (event, tasks) => {
  store.set('tasks', tasks);
  return true;
});

ipcMain.handle('get-game-state', () => {
  return store.get('gameState');
});

ipcMain.handle('save-game-state', (event, gameState) => {
  store.set('gameState', gameState);
  return true;
});

ipcMain.handle('toggle-collapse', (event, state) => {
  if (state !== undefined) {
    isCollapsed = state;
  } else {
    isCollapsed = !isCollapsed;
  }

  if (isCollapsed) {
    mainWindow.setSize(380, COLLAPSED_HEIGHT);
  } else {
    // Return to a reasonable height if not specified, 
    // renderer will call resize-window later anyway
    mainWindow.setSize(380, EXPANDED_HEIGHT);
  }
  return isCollapsed;
});

ipcMain.handle('set-window-size', (event, width, height) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(width, Math.floor(height));
  }
});

ipcMain.handle('resize-window', (event, height) => {
  if (mainWindow && !mainWindow.isDestroyed() && !isCollapsed) {
    const [width] = mainWindow.getSize();
    mainWindow.setSize(width, Math.floor(height), true);
  }
});

ipcMain.handle('set-opacity', (event, opacity) => {
  mainWindow.setOpacity(opacity);
});

// Settings IPC
ipcMain.handle('get-settings', () => {
  return store.get('settings');
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  // Notify main window of settings change
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', settings);
  }
  return true;
});

ipcMain.handle('open-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  settingsWindow = new BrowserWindow({
    width: Math.min(900, screenWidth - 100),
    height: Math.min(650, screenHeight - 100),
    center: true,
    frame: false,
    transparent: true,
    hasShadow: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.setAlwaysOnTop(false);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
});

ipcMain.handle('close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

ipcMain.handle('toggle-settings-fullscreen', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    const isFS = settingsWindow.isFullScreen();
    settingsWindow.setFullScreen(!isFS);
    return !isFS;
  }
  return false;
});

// ---- Database IPC ----
ipcMain.handle('db-add-record', (event, task) => {
  db.addRecord(task);
  return true;
});

ipcMain.handle('db-complete-record', (event, id, accumulatedTime, xpEarned) => {
  db.completeRecord(id, accumulatedTime, xpEarned);
  return true;
});

ipcMain.handle('db-delete-record', (event, id) => {
  db.deleteRecord(id);
  return true;
});

ipcMain.handle('db-get-stats', () => {
  return db.getStats();
});

ipcMain.handle('db-get-history', (event, limit, offset) => {
  return db.getHistory(limit || 200, offset || 0);
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  db.close();
});
