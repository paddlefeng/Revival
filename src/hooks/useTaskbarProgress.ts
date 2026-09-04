/**
 * useTaskbarProgress - 任务栏进度控制 Hook
 * Electron 端直接设置任务栏进度，非 Electron 端静默降级
 */

import { useCallback, useRef } from 'react';
import { isElectron } from '../platform';

export interface TaskbarProgressReturn {
  /** 设置进度值 (0-1) */
  setProgress: (progress: number) => void;
  /** 清除进度显示 */
  clearProgress: () => void;
  /** 当前平台是否支持任务栏进度 */
  isSupported: boolean;
}

/**
 * 任务栏进度控制 Hook
 *
 * @example
 * ```tsx
 * const taskbar = useTaskbarProgress();
 * taskbar.setProgress(0.5); // 50%
 * taskbar.clearProgress();  // 清除
 * ```
 */
export function useTaskbarProgress(): TaskbarProgressReturn {
  const supported = isElectron() && !!window.electronAPI;
  const lastProgress = useRef(-1);

  const setProgress = useCallback(
    (progress: number) => {
      if (!supported) return;
      // 避免重复发送相同的值
      const clamped = Math.max(0, Math.min(1, progress));
      if (clamped === lastProgress.current) return;
      lastProgress.current = clamped;
      window.electronAPI!.setProgressBar(clamped);
    },
    [supported],
  );

  const clearProgress = useCallback(() => {
    if (!supported) return;
    lastProgress.current = -1;
    window.electronAPI!.clearProgressBar();
  }, [supported]);

  return {
    setProgress,
    clearProgress,
    isSupported: supported,
  };
}
