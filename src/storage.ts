/**
 * 跨平台存储抽象层
 * Revival - 支持 Electron（IPC JSON 文件）、Capacitor（Preferences）、Web（localStorage）
 */

import { detectPlatform } from './platform';
import type { RevivalPlatform } from './platform';

/* ------------------------------------------------------------------ */
/*  存储接口                                                           */
/* ------------------------------------------------------------------ */

export interface StorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Electron 实现：通过 IPC 读写 userData 下的 JSON 文件               */
/* ------------------------------------------------------------------ */

class ElectronStorage implements StorageService {
  private cache = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    // 先查内存缓存
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }
    try {
      const raw = localStorage.getItem(`revival:${key}`);
      if (raw === null) return null;
      const value = JSON.parse(raw) as T;
      this.cache.set(key, value);
      return value;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      this.cache.set(key, value);
      localStorage.setItem(`revival:${key}`, JSON.stringify(value));
    } catch (err) {
      console.error('[ElectronStorage] set error:', err);
    }
  }

  async remove(key: string): Promise<void> {
    this.cache.delete(key);
    localStorage.removeItem(`revival:${key}`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('revival:')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

/* ------------------------------------------------------------------ */
/*  Capacitor 实现：使用 @capacitor/preferences                        */
/* ------------------------------------------------------------------ */

class CapacitorStorage implements StorageService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: `revival:${key}` });
      if (value === null || value === undefined) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      console.error('[CapacitorStorage] get error:', err);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: `revival:${key}`, value: JSON.stringify(value) });
    } catch (err) {
      console.error('[CapacitorStorage] set error:', err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: `revival:${key}` });
    } catch (err) {
      console.error('[CapacitorStorage] remove error:', err);
    }
  }

  async clear(): Promise<void> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.clear();
    } catch (err) {
      console.error('[CapacitorStorage] clear error:', err);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Web 实现：使用 localStorage                                        */
/* ------------------------------------------------------------------ */

class WebStorage implements StorageService {
  private readonly prefix = 'revival:';

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (err) {
      console.error('[WebStorage] set error:', err);
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(this.prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

/* ------------------------------------------------------------------ */
/*  工厂函数                                                          */
/* ------------------------------------------------------------------ */

/**
 * 根据当前平台创建对应的存储服务实例
 */
export function createStorage(): StorageService {
  const platform: RevivalPlatform = detectPlatform();

  switch (platform) {
    case 'electron':
      return new ElectronStorage();
    case 'android':
    case 'ios':
      return new CapacitorStorage();
    case 'web':
    default:
      return new WebStorage();
  }
}

/** 全局单例存储服务 */
export const storage: StorageService = createStorage();
