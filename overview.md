# Revival v2.0 — 改造说明

## TL;DR
Revival v2.0 从「网页套壳 Electron 应用」升级为具备**桌面原生能力 + Android 兼容 + 响应式 UI**的真正跨平台照片美化软件。

## 交付概览

| 项目 | 状态 |
|------|------|
| 桌面原生增强 | ✅ 完成（系统托盘、原生菜单、自动更新、Sharp 处理、任务栏进度、原生对话框） |
| 平台感知层 | ✅ 完成（platform.ts + 跨平台存储 + 平台守卫） |
| 响应式 UI | ✅ 完成（三断点自适应 + 手机端底部抽屉） |
| Android 兼容 | ✅ 完成（Capacitor 6 + PWA） |
| 构建验证 | ✅ 通过（Vite build 成功，149 模块，5 个分包） |
| 测试 | ✅ 通过（115/115 测试用例） |

## 改动清单

### 平台感知层
| 文件 | 说明 |
|------|------|
| `src/platform.ts` | 统一平台检测 |
| `src/storage.ts` | 跨平台存储抽象（Electron / Capacitor / Web） |
| `src/components/PlatformGuard.tsx` | 平台守卫组件 |

### 响应式 UI 层
| 文件 | 说明 |
|------|------|
| `src/hooks/useResponsive.ts` | 响应式断点 Hook |
| `src/components/ResponsiveLayout.tsx` | 自适应布局容器 |
| `src/components/MobileDrawer.tsx` | 手机端底部可拖拽抽屉 |

### 原生功能层
| 文件 | 说明 |
|------|------|
| `src/hooks/useTaskbarProgress.ts` | 任务栏进度 Hook |
| `src/hooks/useSharpProcessor.ts` | Sharp 原生图片处理 Hook（降级 Canvas） |
| `src/hooks/useExifData.ts` | EXIF 提取 Hook |
| `src/hooks/usePlatformUpload.tsx` | 平台感知文件上传 |
| `src/hooks/useCapacitorPicker.ts` | Capacitor 文件选择 Hook |
| `src/components/UpdateManager.tsx` | 自动更新 UI 组件 |

### 修改文件
| 文件 | 改动 |
|------|------|
| `package.json` | v2.0，新增 Capacitor/Sharp/electron-updater 等依赖 |
| `index.html` | PWA meta 标签 |
| `vite.config.ts` | 构建分包配置 |
| `.gitignore` | Capacitor/Electron 产物规则 |
| `electron/main.cjs` | 系统托盘/原生菜单/自动更新/Sharp IPC/任务栏进度 |
| `electron/preload.cjs` | IPC 通道桥接 |
| `src/main.tsx` | PWA 注册 + UpdateManager 集成 |
| `src/AppRouter.tsx` | PWA 安装横幅 + Electron 菜单导航 |

## 后续建议

1. **桌面开发**：`npm run electron:dev`
2. **Android 构建**：`npm run cap:build:android`（需 Android SDK + JDK 17）
3. **生产包**：`npm run dist`
4. **自动更新**：将 `electron-builder.yml` 中的 `publish.url` 替换为实际更新服务器地址
