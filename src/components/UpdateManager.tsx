/**
 * UpdateManager - 自动更新状态管理组件
 * 仅在 Electron 环境下渲染，监听更新事件并显示对应 UI
 *
 * 状态流转: idle → checking → downloading → ready
 */

import { useState, useEffect, useCallback } from 'react';
import { isElectron } from '../platform';

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready';

export interface UpdateState {
  status: UpdateStatus;
  progress: number;           // 0-100 下载进度
  version?: string;           // 新版本号
  bytesPerSecond?: number;
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

export function UpdateManager() {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    progress: 0,
  });

  // ---- 订阅 Electron 更新事件 ----
  useEffect(() => {
    if (!isElectron() || !window.electronAPI) return;

    const api = window.electronAPI;

    const handleChecking = () => {
      setState({ status: 'checking', progress: 0 });
    };

    const handleAvailable = (info: { version?: string }) => {
      setState((prev) => ({
        ...prev,
        status: 'downloading',
        version: info.version,
        progress: 0,
      }));
    };

    const handleNotAvailable = () => {
      setState({ status: 'idle', progress: 0 });
      // 短暂显示提示后恢复
    };

    const handleProgress = (progress: { percent: number; bytesPerSecond: number }) => {
      setState((prev) => ({
        ...prev,
        status: 'downloading',
        progress: Math.round(progress.percent * 100) / 100,
        bytesPerSecond: progress.bytesPerSecond,
      }));
    };

    const handleDownloaded = () => {
      setState((prev) => ({
        ...prev,
        status: 'ready',
        progress: 100,
      }));
    };

    api.onUpdateChecking(handleChecking);
    api.onUpdateAvailable(handleAvailable);
    api.onUpdateNotAvailable(handleNotAvailable);
    api.onUpdateProgress(handleProgress);
    api.onUpdateDownloaded(handleDownloaded);

    // 注意：这些事件监听在 Electron 端是长期存在的
    // preload.cjs 使用 ipcRenderer.on() 注册，无需清理
  }, []);

  // ---- 立即重启安装更新 ----
  const handleRestart = useCallback(() => {
    // Electron 中通过 IPC 触发重启
    // 实际由主进程的 autoUpdater.quitAndInstall() 处理
    if (isElectron()) {
      // 渲染进程无法直接调用 quitAndInstall，由主进程的对话框处理
      // 这里只是预留接口，实际逻辑在主进程的 update-downloaded 事件中
      setState({ status: 'idle', progress: 0 });
    }
  }, []);

  // 非 Electron 环境不渲染
  if (!isElectron()) return null;

  // idle 状态不渲染 UI
  if (state.status === 'idle') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="rounded-xl bg-[#1a2332]/95 backdrop-blur-xl border border-white/10 p-4 shadow-2xl">
        {/* 状态标题 */}
        <div className="flex items-center gap-2 mb-2">
          {state.status === 'checking' && (
            <>
              <Spinner />
              <span className="text-white/80 text-sm">检查更新中…</span>
            </>
          )}
          {state.status === 'downloading' && (
            <>
              <DownloadIcon />
              <span className="text-white/80 text-sm">
                正在下载更新{state.version ? ` v${state.version}` : ''}
              </span>
            </>
          )}
          {state.status === 'ready' && (
            <>
              <CheckIcon />
              <span className="text-green-400 text-sm font-medium">更新已就绪</span>
            </>
          )}
        </div>

        {/* 进度条（下载中/就绪） */}
        {(state.status === 'downloading' || state.status === 'ready') && (
          <div className="space-y-2">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${(state.progress * 100)}%`,
                  background: state.status === 'ready'
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-xs">{(state.progress * 100).toFixed(0)}%</span>
              {state.status === 'ready' && (
                <button
                  onClick={handleRestart}
                  className="text-xs px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                >
                  立即重启
                </button>
              )}
            </div>
          </div>
        )}

        {/* 检查中状态 */}
        {state.status === 'checking' && (
          <p className="text-white/40 text-xs">正在后台检查新版本…</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  内联 SVG 图标组件                                                  */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-cyan-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
