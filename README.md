# Revival · 照片美化工作室 / Photo Beautification Studio

> 一个跨平台的照片美化工具：基于画布的模板化编辑器，支持 **桌面（Electron）、Android（Capacitor）与 Web（PWA）** 三端，开箱即用。
>
> A cross-platform photo beautification studio with a canvas-based, template-driven editor, running on **Desktop (Electron), Android (Capacitor) and Web (PWA)**.

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android%20%7C%20Web-2196F3)
![version](https://img.shields.io/badge/version-2.0.0-4CAF50)
![license](https://img.shields.io/badge/license-MIT-blue)
![tests](https://img.shields.io/badge/tests-115%2F115%20passing-brightgreen)

---

## ✨ 功能特性 / Features

### 模板化编辑器 / Template Editors
内置 4 套风格化模板，覆盖主流社交分享场景：

| 模板 | 说明 |
|------|------|
| **光影边框 (Light & Shadow)** | 通用光影边框 + 自由参数调节 |
| **哈苏风 (Hasselblad)** | 哈苏风格排版与边框 |
| **小米风 (Xiaomi)** | 小米风格滤镜与版式 |
| **卡片参数 (Card Params)** | 相机参数卡片，自动嵌入 EXIF 水印 |

### 图像调节 / Adjustments
- 亮度 / 对比度 / 饱和度
- 滤镜（预设风格）
- 模糊 / 阴影 / 圆角
- 缩放 / 旋转
- 背景替换

### 文字与水印 / Text & Watermark
- 文字图层（字体选择、可拖拽定位）
- 相机参数水印：自动读取 **EXIF**（机型 / 光圈 / 快门 / ISO）并渲染到画面

### 导出 / Export
- 单张导出 PNG（可选导出倍率）
- 批量导出（JSZip 打包下载）

### 跨平台原生能力 / Native Capabilities
- 🖥️ **桌面端（Electron）**：系统托盘常驻、原生菜单、原生文件对话框、文件关联（双击 `.jpg/.png/.heic/.webp` 直接用 Revival 打开）、自动更新（electron-updater）、Windows 任务栏进度条、Sharp 原生图片处理（比 Canvas 快 3× 以上，失败自动降级 Canvas）
- 📱 **移动端（Capacitor Android）**：触控操作、响应式布局、底部拖拽参数抽屉（类 iOS 照片编辑体验）
- 🌐 **Web / PWA**：可安装到桌面、Service Worker 离线缓存

### 工程能力 / Engineering
- 平台感知层（`platform.ts` + 跨平台存储抽象 + 平台守卫）
- 响应式三断点自适应（`<640px` / `640–1023px` / `≥1024px`）
- 撤销 / 重做
- **115 / 115** 单元测试用例全部通过（Vitest）

---

## 🛠 技术栈 / Tech Stack

| 层 | 技术 |
|----|------|
| 构建 | Vite 5 + TypeScript 5 |
| 前端 | React 18 + react-router-dom 7 + Tailwind CSS 3 |
| 画布 | Konva 10 + react-konva |
| 桌面 | Electron 31 + electron-builder 24 + electron-updater |
| 移动 | Capacitor 6 (Android) |
| Web | vite-plugin-pwa (manifest + Service Worker) |
| 图像处理 | Sharp（原生，Canvas 降级）+ exifr（EXIF） |
| 批量导出 | JSZip + html2canvas |

---

## 🚀 快速开始 / Getting Started

### 环境要求 / Prerequisites
- Node.js **18+**
- 包管理器：npm（或 pnpm / yarn）
- Android 构建需要：Android SDK + JDK 17
- 桌面构建在 Windows 上生成 NSIS 安装包

### 安装 / Install
```bash
git clone https://github.com/<your-username>/revival.git
cd revival
npm install
```

### 开发模式 / Develop
```bash
# Web 开发（默认 http://localhost:5173）
npm run dev

# 桌面开发（带热重载的 Electron 窗口）
npm run electron:dev
```

### 构建 / Build
```bash
# Web 生产构建
npm run build

# Windows 桌面安装包（输出到 release/）
npm run dist

# Android APK（需先配置 Android 环境）
npm run cap:build:android
```

### PWA / 移动端预览
```bash
# 启动可局域网访问的 Web 服务（手机扫码或同网访问）
npm run dev:mobile
```

---

## 📂 项目结构 / Project Structure

```
revival/
├── electron/                 # Electron 主进程（托盘/菜单/自动更新/Sharp IPC）
│   ├── main.cjs
│   └── preload.cjs
├── src/
│   ├── pages/                # 页面 / 编辑器
│   │   ├── TemplateSelectPage.tsx   # 模板选择
│   │   ├── EditorPage.tsx           # 通用编辑器（光影边框）
│   │   ├── HasselbladPage.tsx       # 哈苏风
│   │   ├── XiaomiPage.tsx           # 小米风
│   │   ├── CardParamsPage.tsx       # 卡片参数（EXIF 水印）
│   │   └── LoadingPage.tsx
│   ├── components/           # 组件（Konva 预览、移动抽屉、平台守卫等）
│   ├── hooks/                # 平台感知 Hook（EXIF / Sharp / 任务栏进度 / 上传等）
│   ├── constants/            # 字体与品牌配置
│   ├── utils/                # 批量导出、EXIF、图像工具
│   ├── types/                # 类型声明（electronAPI 等）
│   ├── platform.ts           # 平台检测层
│   ├── storage.ts            # 跨平台存储抽象
│   └── AppRouter.tsx         # 路由 + PWA 安装横幅
├── android/                  # Capacitor 生成的 Android 工程
├── docs/                     # 设计文档（PRD / 架构 / QA 报告 / 图）
├── public/                   # 静态资源（图标 / 字体 / manifest / sw）
└── scripts/                  # 构建辅助脚本
```

---

## 🏗 架构概览 / Architecture

Revival 采用 **平台感知（Platform-Aware）** 分层设计，同一套 React UI 可运行在三种运行时：

```
┌─────────────────────────────────────────────┐
│               React UI (Konva Canvas)         │
├─────────────────────────────────────────────┤
│   Platform Guard · Responsive Layout · Drawer │  ← 统一 UI 层
├─────────────────────────────────────────────┤
│   Hooks: EXIF / Sharp / Taskbar / Upload      │  ← 平台感知能力层
├─────────────────────────────────────────────┤
│   platform.ts · storage.ts (跨平台存储抽象)    │  ← 平台检测 / 抽象层
├──────────────┬──────────────┬────────────────┤
│  Electron    │ Capacitor    │  Web / PWA     │  ← 运行时适配
│  (tray/menu/ │  (Android    │  (manifest/    │
│   updater/   │   picker/    │   SW/offline)  │
│   sharp)     │   storage)   │                │
└──────────────┴──────────────┴────────────────┘
```

详细设计见 [`docs/ARCHITECTURE-revival-transformation.md`](docs/ARCHITECTURE-revival-transformation.md)，需求与验收见 [`docs/PRD-revival-transformation.md`](docs/PRD-revival-transformation.md)，测试报告见 [`docs/QA-REPORT-revival-transformation.md`](docs/QA-REPORT-revival-transformation.md)。

---

## 📜 可用脚本 / Scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Web 开发服务器 |
| `npm run dev:mobile` | 启动局域网可访问的 Web 服务（移动端调试） |
| `npm run build` | Web 生产构建 |
| `npm run preview` | 预览构建产物 |
| `npm run electron` | 以 Electron 运行（需先 build） |
| `npm run electron:dev` | Electron 开发模式（Vite + 热重载） |
| `npm run dist` | 构建并打包 Windows NSIS 安装包 |
| `npm run cap:sync` | 同步 Web 资源到 Capacitor 原生工程 |
| `npm run cap:build:android` | 构建 Android Debug APK |
| `npm test` | 运行 Vitest 单元测试 |

---

## 🗺 路线图 / Roadmap

- [ ] macOS / Linux 安装包（dmg + AppImage）
- [ ] iOS 兼容（Capacitor iOS）
- [ ] 触控手势：双指缩放 / 旋转 / 拖动
- [ ] 深色 / 浅色主题切换
- [ ] 国际化（i18n，当前以中文为主）
- [ ] 图层系统增强（多文字 / 多图片图层）

---

## 🤝 贡献 / Contributing

欢迎 Issue 与 PR。
1. Fork 本仓库并创建特性分支 (`git checkout -b feat/your-feature`)
2. 提交改动（`npm test` 需通过）
3. 发起 Pull Request

---

## 📄 许可证 / License

本项目基于 **MIT License** 开源。详见 [LICENSE](LICENSE)。

---

<p align="center">Made with ❤️ by feng · Revival v2.0.0</p>
