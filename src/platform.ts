/**
 * 平台检测工具 - 识别当前运行环境
 * Revival 支持 Desktop (Electron)、Mobile (Capacitor/Android) 和 Web 模式
 * 支持在测试环境下覆写 platform 以模拟不同运行环境
 */

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
    capacitorAPI?: {
      isNative: boolean;
      platform: string;
    };
  }
}

export type RevivalPlatform = 'electron' | 'android' | 'ios' | 'web';

// 允许测试覆写平台值
let _overriddenPlatform: RevivalPlatform | null = null;

export function setPlatformForTest(platform: RevivalPlatform | null): void {
  _overriddenPlatform = platform;
}

export function detectPlatform(): RevivalPlatform {
  // 测试覆写优先
  if (_overriddenPlatform) return _overriddenPlatform;
  // 1. 检测 Electron
  if (window.electronAPI) {
    return 'electron';
  }
  // 2. 检测 Capacitor (Android/iOS)
  if (typeof (window as any).Capacitor !== 'undefined') {
    const cap = (window as any).Capacitor;
    if (cap.getPlatform() === 'android') return 'android';
    if (cap.getPlatform() === 'ios') return 'ios';
  }
  // 3. 默认 Web (开发调试)
  return 'web';
}

/** 获取当前平台（动态求值，支持测试覆写） */
export function getPlatform(): RevivalPlatform {
  return detectPlatform();
}

/** 模块级缓存（旧版，仅用于向后兼容） */
export const PLATFORM = detectPlatform();

export function isElectron(): boolean {
  return detectPlatform() === 'electron';
}

export function isMobile(): boolean {
  const p = detectPlatform();
  return p === 'android' || p === 'ios';
}

export function isAndroid(): boolean {
  return detectPlatform() === 'android';
}

export function isTouchDevice(): boolean {
  return isMobile() || 'ontouchstart' in window;
}
