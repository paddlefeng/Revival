import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoadingPage } from "./pages/LoadingPage";
import { TemplateSelectPage } from "./pages/TemplateSelectPage";
import { EditorPage } from "./pages/EditorPage";
import { HasselbladPage } from "./pages/HasselbladPage";
import { XiaomiPage } from "./pages/XiaomiPage";
import { CardParamsPage } from "./pages/CardParamsPage";
import { isElectron, isMobile } from "./platform";
import { PlatformGuard } from "./components/PlatformGuard";

function RouterWrapper() {
  const [loading, setLoading] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    // 缩短移动端加载时间
    const delay = isMobile() ? 800 : 1500;
    const timer = setTimeout(() => {
      setLoading(false);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // 监听 Electron 菜单导航
  useEffect(() => {
    if (isElectron() && window.electronAPI?.onNavigate) {
      window.electronAPI.onNavigate((route: string) => {
        window.location.hash = `#${route}`;
      });
    }
  }, []);

  // 监听 PWA 安装事件
  useEffect(() => {
    const handleInstallReady = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.prompt) {
        setInstallPrompt(detail.prompt);
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("pwa-install-ready", handleInstallReady);
    return () => window.removeEventListener("pwa-install-ready", handleInstallReady);
  }, []);

  // 检查是否已安装（display-mode: standalone）
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallBanner(false);
    }
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as any).prompt();
    const { outcome } = await (installPrompt as any).userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setInstallPrompt(null);
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <>
      {/* PWA 安装横幅 */}
      {showInstallBanner && (
        <PlatformGuard platform="web">
          <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-cyan-600 to-blue-600 p-3 flex items-center justify-between shadow-lg">
            <span className="text-white text-sm font-medium">安装 Revival 获得更好的体验</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="px-4 py-1.5 rounded-lg bg-white text-blue-600 text-sm font-bold hover:bg-white/90 transition-colors"
              >
                安装
              </button>
              <button
                onClick={handleDismissBanner}
                className="px-3 py-1.5 rounded-lg text-white/80 text-sm hover:text-white transition-colors"
              >
                稍后
              </button>
            </div>
          </div>
        </PlatformGuard>
      )}

      <Routes>
        <Route path="/templates" element={<TemplateSelectPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/editor-hasselblad" element={<HasselbladPage />} />
        <Route path="/editor-xiaomi" element={<XiaomiPage />} />
        <Route path="/editor-cardparams" element={<CardParamsPage />} />
        <Route path="/" element={<Navigate to="/templates" replace />} />
        <Route path="*" element={<Navigate to="/templates" replace />} />
      </Routes>
    </>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <RouterWrapper />
    </HashRouter>
  );
}
