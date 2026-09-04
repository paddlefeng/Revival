const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// ============================================================
// 常量和状态
// ============================================================
const isDev = !!process.env.VITE_DEV_SERVER_URL;
let mainWindow = null;
let tray = null;
let isQuitting = false;

// ============================================================
// 自动更新
// ============================================================
function setupAutoUpdater() {
  if (isDev) {
    console.log('[AutoUpdater] 开发模式，跳过自动更新');
    return;
  }
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://releases.example.com',
  });
  autoUpdater.checkForUpdates();
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-checking');
  });
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info);
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available');
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', progress);
  });
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已下载',
      message: '新版本已下载完成，是否立即重启以应用更新？',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater]', err.message);
  });
}

// ============================================================
// 系统托盘
// ============================================================
function createTray() {
  // 使用 32x32 图标
  const iconPath = path.join(__dirname, '../public/icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 32, height: 32 }));
  tray.setToolTip('Revival - 照片美化工作室');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ============================================================
// 系统菜单
// ============================================================
function createAppMenu() {
  const template = [
    {
      label: 'Revival',
      submenu: [
        { role: 'about', label: '关于 Revival' },
        { type: 'separator' },
        {
          label: '偏好设置...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('open-settings');
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出 Revival' },
      ],
    },
    {
      label: '文件',
      submenu: [
        {
          label: '打开图片...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile', 'multiSelections'],
              filters: [
                { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'heic', 'webp', 'bmp', 'tiff'] },
                { name: '视频', extensions: ['mp4', 'mov', 'avi', 'mkv'] },
                { name: '所有文件', extensions: ['*'] },
              ],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('files-opened', result.filePaths);
            }
          },
        },
        { type: 'separator' },
        {
          label: '导出为 PNG',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('export-image'),
        },
        {
          label: '批量导出 ZIP',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send('batch-export'),
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'togglefullscreen', label: '全屏' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '模板',
      submenu: [
        {
          label: '光影边框',
          click: () => mainWindow?.webContents.send('navigate', '/editor'),
        },
        {
          label: '哈苏风',
          click: () => mainWindow?.webContents.send('navigate', '/editor-hasselblad'),
        },
        {
          label: '小米风',
          click: () => mainWindow?.webContents.send('navigate', '/editor-xiaomi'),
        },
        {
          label: '卡片参数',
          click: () => mainWindow?.webContents.send('navigate', '/editor-cardparams'),
        },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '置于顶层' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新...',
          click: () => {
            if (!isDev) autoUpdater.checkForUpdates();
          },
        },
        { type: 'separator' },
        {
          label: '关于 Revival',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Revival',
              message: `Revival v${app.getVersion()}`,
              detail: '照片美化工作室\n基于 Electron + React + Konva.js 构建',
            });
          },
        },
      ],
    },
  ];
  // macOS 需要把第一个菜单设为 app 菜单
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    // Windows/Linux 使用精简菜单
    const winMenu = template.slice(1); // 去掉 "Revival" 菜单
    Menu.setApplicationMenu(Menu.buildFromTemplate(winMenu));
  }
}

// ============================================================
// 原生图片处理（Sharp）
// ============================================================
ipcMain.handle('native-image-process', async (event, { operation, inputPath, options }) => {
  try {
    const sharp = require('sharp');
    let pipeline = sharp(inputPath);

    switch (operation) {
      case 'resize':
        pipeline = pipeline.resize(options.width, options.height, { fit: options.fit || 'inside' });
        break;
      case 'convert':
        pipeline = pipeline.toFormat(options.format || 'png', options.formatOptions || {});
        break;
      case 'metadata':
        const meta = await pipeline.metadata();
        return meta;
      case 'compress':
        pipeline = pipeline.jpeg({ quality: options.quality || 85 });
        break;
      case 'thumbnail':
        pipeline = pipeline.resize(options.size || 300, options.size || 300, { fit: 'cover' });
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    const buffer = await pipeline.toBuffer();
    return { data: buffer.toString('base64'), mimeType: `image/${options.format || 'png'}` };
  } catch (err) {
    console.error('[Sharp]', err);
    throw err;
  }
});

// ============================================================
// IPC: 窗口控制
// ============================================================
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() || false;
});

// ============================================================
// IPC: 原生文件对话框
// ============================================================
ipcMain.handle('show-open-dialog', async (event, options) => {
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('get-file-path', async (event, filePath) => {
  return path.resolve(filePath);
});

// ============================================================
// IPC: 任务栏进度
// ============================================================
ipcMain.on('set-progress-bar', (event, progress) => {
  if (mainWindow) {
    mainWindow.setProgressBar(progress);
  }
});

ipcMain.on('clear-progress-bar', () => {
  if (mainWindow) {
    mainWindow.setProgressBar(-1);
  }
});

// ============================================================
// IPC: 应用信息
// ============================================================
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// ============================================================
// 创建主窗口
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1351,
    minHeight: 531,
    title: 'Revival',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,
    show: false, // 等准备好再显示
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 窗口最大化/恢复时通知渲染进程
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-changed', false);
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ============================================================
// 应用生命周期
// ============================================================
app.whenReady().then(() => {
  createWindow();
  createAppMenu();
  createTray();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});
