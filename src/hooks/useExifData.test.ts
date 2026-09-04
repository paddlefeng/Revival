/**
 * useExifData EXIF 提取 Hook 测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExifData } from './useExifData';

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

// Create a controllable mock for exifr.parse
const mockExifrParse = vi.fn();

// Mock exifr - dynamic import pattern used in useExifData
vi.mock('exifr', () => ({
  default: {
    parse: mockExifrParse,
  },
  parse: mockExifrParse,
}));

import { isElectron } from '../platform';
const mockedIsElectron = vi.mocked(isElectron);

describe('useExifData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('返回结构验证', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(false);
    });

    it('should return the correct interface structure', () => {
      const { result } = renderHook(() => useExifData());
      expect(result.current).toHaveProperty('extractExif');
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('clearData');
      expect(typeof result.current.extractExif).toBe('function');
      expect(typeof result.current.clearData).toBe('function');
    });

    it('should start with loading=false, error=null, data=null', () => {
      const { result } = renderHook(() => useExifData());
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeNull();
    });
  });

  describe('Web 环境降级（使用 exifr）', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(false);
    });

    it('should use exifr for data URL extraction', async () => {
      // Mock fetch for data URL
      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['fake-image-data'])),
      });

      // Set up exifr to return mock EXIF data
      mockExifrParse.mockResolvedValue({
        Make: 'Canon',
        Model: 'EOS R5',
        FNumber: 2.8,
        ISO: 800,
        FocalLength: 50,
        DateTimeOriginal: '2024:01:15 10:30:00',
      });

      const { result } = renderHook(() => useExifData());

      await act(async () => {
        const data = await result.current.extractExif('data:image/jpeg;base64,test');
        expect(data).not.toBeNull();
        expect(data!.Make).toBe('Canon');
        expect(data!.Model).toBe('EOS R5');
        expect(data!.FNumber).toBe(2.8);
        expect(data!.ISO).toBe(800);
        expect(data!.FocalLength).toBe(50);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data).not.toBeNull();
    });

    it('should handle exifr parse errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['fake'])),
      });

      mockExifrParse.mockRejectedValue(new Error('Parse failed'));

      const { result } = renderHook(() => useExifData());

      await act(async () => {
        const data = await result.current.extractExif('data:image/jpeg;base64,test');
        expect(data).toBeNull();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should handle non-data URL paths', async () => {
      mockExifrParse.mockRejectedValue(new Error('Parse failed'));

      const { result } = renderHook(() => useExifData());

      await act(async () => {
        const data = await result.current.extractExif('/path/to/photo.jpg');
        expect(data).toBeNull();
      });

      expect(result.current.data).toBeNull();
    });

    it('should return null when exifr returns no data', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['fake'])),
      });

      mockExifrParse.mockResolvedValue(null);

      const { result } = renderHook(() => useExifData());

      await act(async () => {
        const data = await result.current.extractExif('data:image/jpeg;base64,test');
        expect(data).toBeNull();
      });

      expect(result.current.data).toBeNull();
    });
  });

  describe('clearData', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(false);
    });

    it('should clear data and error when called', async () => {
      const { result } = renderHook(() => useExifData());

      await act(async () => {
        await result.current.extractExif('test.jpg');
      });

      act(() => {
        result.current.clearData();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Electron 环境', () => {
    beforeEach(() => {
      mockedIsElectron.mockReturnValue(true);
      window.electronAPI = {
        processImage: vi.fn(),
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
    });

    it('should attempt Electron IPC', async () => {
      const mockProcessImage = vi.fn().mockResolvedValue({ data: 'metadata-data', mimeType: 'application/json' });
      window.electronAPI!.processImage = mockProcessImage;

      const { result } = renderHook(() => useExifData());

      await act(async () => {
        const data = await result.current.extractExif('/path/to/photo.jpg');
        // Should have called processImage with metadata operation
        expect(mockProcessImage).toHaveBeenCalledWith('metadata', '/path/to/photo.jpg', {});
        // Since the implementation falls through to exifr which will throw,
        // data will be null
        expect(data).toBeNull();
      });
    });

    it('should handle Electron IPC errors gracefully', async () => {
      const mockProcessImage = vi.fn().mockRejectedValue(new Error('IPC failed'));
      window.electronAPI!.processImage = mockProcessImage;

      const { result } = renderHook(() => useExifData());

      await act(async () => {
        const data = await result.current.extractExif('/path/to/photo.jpg');
        expect(data).toBeNull();
      });

      expect(result.current.loading).toBe(false);
    });
  });
});
