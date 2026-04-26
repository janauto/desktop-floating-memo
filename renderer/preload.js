const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTasks: (tasks) => ipcRenderer.invoke('save-tasks', tasks),
  getGameState: () => ipcRenderer.invoke('get-game-state'),
  saveGameState: (state) => ipcRenderer.invoke('save-game-state', state),
  toggleCollapse: (state) => ipcRenderer.invoke('toggle-collapse', state),
  setWindowSize: (w, h) => ipcRenderer.invoke('set-window-size', w, h),
  resizeWindow: (height) => ipcRenderer.invoke('resize-window', height),
  setOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  toggleSettingsFullscreen: () => ipcRenderer.invoke('toggle-settings-fullscreen'),
  onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (event, settings) => callback(settings)),
  // Database
  dbAddRecord: (task) => ipcRenderer.invoke('db-add-record', task),
  dbCompleteRecord: (id, accTime, xp) => ipcRenderer.invoke('db-complete-record', id, accTime, xp),
  dbDeleteRecord: (id) => ipcRenderer.invoke('db-delete-record', id),
  dbGetStats: () => ipcRenderer.invoke('db-get-stats'),
  dbGetHistory: (limit, offset) => ipcRenderer.invoke('db-get-history', limit, offset)
});
