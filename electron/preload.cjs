const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================
  // 窗口控制
  // ============================================================
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window-state-changed', (_event, isMaximized) => callback(isMaximized));
  },

  // ============================================================
  // 原生对话框
  // ============================================================
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // ============================================================
  // 原生图片处理（Sharp）
  // ============================================================
  processImage: (operation, inputPath, options) =>
    ipcRenderer.invoke('native-image-process', { operation, inputPath, options }),

  // ============================================================
  // 任务栏进度
  // ============================================================
  setProgressBar: (progress) => ipcRenderer.send('set-progress-bar', progress),
  clearProgressBar: () => ipcRenderer.send('clear-progress-bar'),

  // ============================================================
  // 应用信息
  // ============================================================
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // ============================================================
  // 自动更新
  // ============================================================
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_e, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_e, p) => callback(p)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),

  // ============================================================
  // 导航
  // ============================================================
  onNavigate: (callback) => ipcRenderer.on('navigate', (_e, route) => callback(route)),

  // ============================================================
  // 文件打开/导出事件
  // ============================================================
  onFilesOpened: (callback) => ipcRenderer.on('files-opened', (_e, files) => callback(files)),
  onExportImage: (callback) => ipcRenderer.on('export-image', callback),
  onBatchExport: (callback) => ipcRenderer.on('batch-export', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
});
