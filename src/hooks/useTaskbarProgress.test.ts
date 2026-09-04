/**
 * useTaskbarProgress 任务栏进度控制 Hook 测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskbarProgress } from './useTaskbarProgress';

// Mock the platform module so isElectron can be controlled
vi.mock('../platform', () => ({
  isElectron: vi.fn(),
  detectPlatform: vi.fn(() => 'web'),
  isMobile: vi.fn(() => false),
  isAndroid: vi.fn(() => false),
  isTouchDevice: vi.fn(() => false),
  PLATFORM: 'web',
  RevivalPlatform: {} as any,
}));

import { isElectron } from '../platform';
import type { Mock } from 'vitest';

const mockedIsElectron = vi.mocked(isElectron);

describe('useTaskbarProgress', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Web 环境（非 Electron）', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(false);
    });

    it('should return isSupported as false', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      expect(result.current.isSupported).toBe(false);
    });

    it('should not throw when calling setProgress', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      expect(() => {
        act(() => {
          result.current.setProgress(0.5);
        });
      }).not.toThrow();
    });

    it('should not throw when calling clearProgress', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      expect(() => {
        act(() => {
          result.current.clearProgress();
        });
      }).not.toThrow();
    });

    it('should have the correct return type structure', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      expect(result.current).toHaveProperty('setProgress');
      expect(result.current).toHaveProperty('clearProgress');
      expect(result.current).toHaveProperty('isSupported');
      expect(typeof result.current.setProgress).toBe('function');
      expect(typeof result.current.clearProgress).toBe('function');
      expect(typeof result.current.isSupported).toBe('boolean');
    });
  });

  describe('Electron 环境', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(true);
      window.electronAPI = {
        setProgressBar: vi.fn(),
        clearProgressBar: vi.fn(),
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
        isMaximized: vi.fn(),
        onWindowStateChanged: vi.fn(),
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
        processImage: vi.fn(),
        getAppVersion: vi.fn(),
        getAppPath: vi.fn(),
        onUpdateChecking: vi.fn(),
        onUpdateAvailable: vi.fn(),
        onUpdateNotAvailable: vi.fn(),
        onUpdateProgress: vi.fn(),
        onUpdateDownloaded: vi.fn(),
        onNavigate: vi.fn(),
        onFilesOpened: vi.fn(),
        onExportImage: vi.fn(),
        onBatchExport: vi.fn(),
        onOpenSettings: vi.fn(),
      } as any;
    });

    it('should return isSupported as true', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      expect(result.current.isSupported).toBe(true);
    });

    it('should call setProgressBar with clamped value (0-1)', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      act(() => {
        result.current.setProgress(0.5);
      });
      expect(window.electronAPI!.setProgressBar).toHaveBeenCalledWith(0.5);
    });

    it('should clamp values below 0 to 0', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      act(() => {
        result.current.setProgress(-0.5);
      });
      expect(window.electronAPI!.setProgressBar).toHaveBeenCalledWith(0);
    });

    it('should clamp values above 1 to 1', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      act(() => {
        result.current.setProgress(1.5);
      });
      expect(window.electronAPI!.setProgressBar).toHaveBeenCalledWith(1);
    });

    it('should call clearProgressBar on clearProgress', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      act(() => {
        result.current.clearProgress();
      });
      expect(window.electronAPI!.clearProgressBar).toHaveBeenCalled();
    });

    it('should not call setProgressBar for duplicate values', () => {
      const { result } = renderHook(() => useTaskbarProgress());
      act(() => {
        result.current.setProgress(0.5);
      });
      act(() => {
        result.current.setProgress(0.5);
      });
      // Should only be called once due to duplicate detection
      expect(window.electronAPI!.setProgressBar).toHaveBeenCalledTimes(1);
    });
  });
});
