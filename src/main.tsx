import React from "react";
import ReactDOM from "react-dom/client";
import { AppRouter } from "./AppRouter";
import { UpdateManager } from "./components/UpdateManager";
import { PlatformGuard } from "./components/PlatformGuard";
import "./index.css";

import { initRoundRect } from "./utils/imageHelpers";
initRoundRect();

// ---- PWA Service Worker 注册 ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.debug("[PWA] Service Worker registered");
      })
      .catch((err) => {
        console.debug("[PWA] Service Worker registration failed:", err);
      });
  });
}

// ---- PWA 安装提示 ----
let deferredPrompt: Event | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  // 阻止 Chrome 自动显示安装提示
  e.preventDefault();
  deferredPrompt = e;
  // 触发自定义事件供 AppRouter 使用
  window.dispatchEvent(new CustomEvent("pwa-install-ready", { detail: { prompt: e } }));
});

window.addEventListener("appinstalled", () => {
  console.debug("[PWA] App installed successfully");
  deferredPrompt = null;
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
    {/* 全局更新管理器（仅 Electron 环境） */}
    <PlatformGuard platform="electron">
      <UpdateManager />
    </PlatformGuard>
  </React.StrictMode>
);
