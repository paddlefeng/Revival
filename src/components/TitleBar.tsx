import React from "react";

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

interface TitleBarProps {
  showBackButton?: boolean;
  onBack?: () => void;
  title?: string;
}

export function TitleBar({ showBackButton = false, onBack, title = "REVIVAL" }: TitleBarProps) {
  return (
    <div
      className="h-14 flex items-center px-5 shrink-0 backdrop-blur-xl border-b border-white/5"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* 左侧区域：返回按钮（如果显示） */}
      <div className="flex items-center flex-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {showBackButton && onBack && (
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onBack}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm text-white/70">返回模板</span>
          </div>
        )}
      </div>

      {/* 中间标题 */}
      <div className="text-xs uppercase tracking-[0.35em] text-white/45 font-medium">
        {title}
      </div>

      {/* 右侧窗口控制按钮 */}
      <div className="flex gap-2 flex-1 justify-end" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <div onClick={() => window.electronAPI?.minimize()} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer" />
        <div onClick={() => window.electronAPI?.maximize()} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer" />
        <div onClick={() => window.electronAPI?.close()} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer" />
      </div>
    </div>
  );
}