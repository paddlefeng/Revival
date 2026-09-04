/**
 * useCapacitorPicker Capacitor 文件选择 Hook 测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCapacitorPicker } from './useCapacitorPicker';

// Mock platform module so detectPlatform can be controlled
vi.mock('../platform', () => ({
  isElectron: vi.fn(() => false),
  detectPlatform: vi.fn(() => 'web'),
  isMobile: vi.fn(() => false),
  isAndroid: vi.fn(() => false),
  isTouchDevice: vi.fn(() => false),
  PLATFORM: 'web',
  RevivalPlatform: {} as any,
}));

import { detectPlatform, isAndroid } from '../platform';
const mockedDetectPlatform = vi.mocked(detectPlatform);
const mockedIsAndroid = vi.mocked(isAndroid);

describe('useCapacitorPicker', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Web 环境', () => {
    beforeEach(() => {
      mockedDetectPlatform.mockReturnValue('web');
      mockedIsAndroid.mockReturnValue(false);
    });

    it('should return the correct interface structure', () => {
      const { result } = renderHook(() => useCapacitorPicker());
      expect(result.current).toHaveProperty('pickMedia');
      expect(result.current).toHaveProperty('isSupported');
      expect(result.current).toHaveProperty('fileInputRef');
      expect(typeof result.current.pickMedia).toBe('function');
      expect(typeof result.current.isSupported).toBe('boolean');
    });

    it('should have isSupported false in web environment', () => {
      const { result } = renderHook(() => useCapacitorPicker());
      expect(result.current.isSupported).toBe(false);
    });

    it('should have a fileInputRef with current null', () => {
      const { result } = renderHook(() => useCapacitorPicker());
      expect(result.current.fileInputRef.current).toBeNull();
    });
  });

  describe('Electron 环境', () => {
    beforeEach(() => {
      mockedDetectPlatform.mockReturnValue('electron');
      mockedIsAndroid.mockReturnValue(false);
    });

    it('should have isSupported false in electron (only android/ios supported)', () => {
      const { result } = renderHook(() => useCapacitorPicker());
      expect(result.current.isSupported).toBe(false);
    });
  });

  describe('Android 环境', () => {
    beforeEach(() => {
      mockedDetectPlatform.mockReturnValue('android');
      mockedIsAndroid.mockReturnValue(true);
    });

    it('should have isSupported true on android', () => {
      const { result } = renderHook(() => useCapacitorPicker());
      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('iOS 环境', () => {
    beforeEach(() => {
      mockedDetectPlatform.mockReturnValue('ios');
      mockedIsAndroid.mockReturnValue(false);
    });

    it('should have isSupported true on ios', () => {
      const { result } = renderHook(() => useCapacitorPicker());
      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('类型定义验证', () => {
    beforeEach(() => {
      mockedDetectPlatform.mockReturnValue('web');
      mockedIsAndroid.mockReturnValue(false);
    });

    it('should export proper PickedFile interface shape', async () => {
      const { result } = renderHook(() => useCapacitorPicker());
      // pickMedia creates a file input and triggers a click in web mode
      // In jsdom, the file input is created but since no actual file is selected,
      // the pickMedia promise resolves to null after a cancel event
      // To avoid hanging, we need to simulate the cancel

      // Spy on createElement to intercept file input creation
      const origCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement');

      // Start the pickMedia call (it will hang waiting for file input)
      const pickPromise = result.current.pickMedia({ accept: 'image/*' });

      // Find the created file input and trigger cancel
      await vi.waitFor(() => {
        expect(createElementSpy).toHaveBeenCalledWith('input');
      });

      // Get the last created input and trigger cancel
      const inputCalls = createElementSpy.mock.results.filter(r => r.value?.type === 'file');
      if (inputCalls.length > 0) {
        const input = inputCalls[inputCalls.length - 1].value;
        input.dispatchEvent(new Event('cancel'));
      }

      const pickResult = await pickPromise;
      expect(pickResult).toBeNull();
    }, 10000);
  });
});
