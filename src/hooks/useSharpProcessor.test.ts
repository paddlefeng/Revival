/**
 * useSharpProcessor 原生图片处理 Hook 测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharpProcessor } from './useSharpProcessor';

// Mock platform module so isElectron can be controlled
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
const mockedIsElectron = vi.mocked(isElectron);

describe('useSharpProcessor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('返回结构验证', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(false);
    });

    it('should return the correct interface structure', () => {
      const { result } = renderHook(() => useSharpProcessor());
      expect(result.current).toHaveProperty('processImage');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('result');
      expect(result.current).toHaveProperty('clearResult');
      expect(typeof result.current.processImage).toBe('function');
      expect(typeof result.current.loading).toBe('boolean');
      expect(typeof result.current.clearResult).toBe('function');
    });

    it('should start with loading=false, error=null, result=null', () => {
      const { result } = renderHook(() => useSharpProcessor());
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
    });
  });

  describe('非 Electron 环境降级', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(false);
    });

    it('should attempt canvas fallback and handle Image loading failure gracefully', async () => {
      const { result } = renderHook(() => useSharpProcessor());

      // Mock Image to simulate failure
      const origImage = globalThis.Image;
      const mockImage = vi.fn(() => {
        const img = { crossOrigin: '', src: '' } as any;
        setTimeout(() => {
          img.onerror?.(new Event('error'));
        }, 10);
        return img;
      });
      (globalThis as any).Image = mockImage;

      let res: any;
      await act(async () => {
        res = await result.current.processImage('resize', 'invalid-path.jpg', { width: 100, height: 100 });
      });

      expect(res).toBeNull();
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);

      (globalThis as any).Image = origImage;
    });

    it('should handle metadata operation gracefully', async () => {
      const { result } = renderHook(() => useSharpProcessor());

      // Mock Image to simulate failure
      const origImage = globalThis.Image;
      const mockImage = vi.fn(() => {
        const img = { crossOrigin: '', src: '' } as any;
        setTimeout(() => {
          img.onerror?.(new Event('error'));
        }, 10);
        return img;
      });
      (globalThis as any).Image = mockImage;

      await act(async () => {
        await result.current.processImage('metadata', 'test.jpg');
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);

      (globalThis as any).Image = origImage;
    });
  });

  describe('clearResult', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(false);
    });

    it('should clear error and result when called', () => {
      const { result } = renderHook(() => useSharpProcessor());
      act(() => {
        result.current.clearResult();
      });
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
    });
  });

  describe('Electron 环境', () => {
    const mockProcessImage = vi.fn();

    beforeEach(() => {
      mockedIsElectron.mockReturnValue(true);
      window.electronAPI = {
        processImage: mockProcessImage,
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
        isMaximized: vi.fn(),
        onWindowStateChanged: vi.fn(),
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
        setProgressBar: vi.fn(),
        clearProgressBar: vi.fn(),
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
      mockProcessImage.mockReset();
    });

    it('should call electronAPI.processImage with correct params', async () => {
      mockProcessImage.mockResolvedValue({ data: 'base64data', mimeType: 'image/png' });
      const { result } = renderHook(() => useSharpProcessor());

      await act(async () => {
        await result.current.processImage('resize', '/path/to/image.jpg', { width: 800 });
      });

      expect(mockProcessImage).toHaveBeenCalledWith('resize', '/path/to/image.jpg', { width: 800 });
    });

    it('should populate result on success', async () => {
      mockProcessImage.mockResolvedValue({ data: 'base64data', mimeType: 'image/png' });
      const { result } = renderHook(() => useSharpProcessor());

      await act(async () => {
        await result.current.processImage('convert', '/path/to/img.jpg', { format: 'webp' });
      });

      expect(result.current.result).toEqual({ data: 'base64data', mimeType: 'image/png' });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle electronAPI error gracefully', async () => {
      mockProcessImage.mockRejectedValue(new Error('Sharp process failed'));
      const { result } = renderHook(() => useSharpProcessor());

      await act(async () => {
        const res = await result.current.processImage('resize', '/path/to/img.jpg');
        expect(res).toBeNull();
      });

      expect(result.current.error).toBe('Sharp process failed');
      expect(result.current.loading).toBe(false);
    });
  });
});
