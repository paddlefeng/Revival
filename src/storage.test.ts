/**
 * 跨平台存储抽象层测试
 * Revival - StorageService / WebStorage / createStorage()
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StorageService } from './storage';
import { createStorage } from './storage';

/* ------------------------------------------------------------------ */
/*  WebStorage Implementation Tests                                    */
/* ------------------------------------------------------------------ */

describe('WebStorage (default createStorage implementation)', () => {
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    // For web tests, ensure electronAPI is undefined
    window.electronAPI = undefined;
    storage = createStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('get / set', () => {
    it('should store and retrieve a string value', async () => {
      await storage.set('test-key', 'hello world');
      const result = await storage.get<string>('test-key');
      expect(result).toBe('hello world');
    });

    it('should store and retrieve a number value', async () => {
      await storage.set('count', 42);
      const result = await storage.get<number>('count');
      expect(result).toBe(42);
    });

    it('should store and retrieve an object', async () => {
      const obj = { name: 'Revival', version: 2 };
      await storage.set('config', obj);
      const result = await storage.get<typeof obj>('config');
      expect(result).toEqual(obj);
    });

    it('should store and retrieve an array', async () => {
      const arr = [1, 2, 3, 4, 5];
      await storage.set('list', arr);
      const result = await storage.get<number[]>('list');
      expect(result).toEqual(arr);
    });

    it('should store and retrieve a boolean', async () => {
      await storage.set('flag', true);
      const result = await storage.get<boolean>('flag');
      expect(result).toBe(true);
    });

    it('should return null for a non-existent key', async () => {
      const result = await storage.get<string>('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for a key that was removed', async () => {
      await storage.set('temp', 'value');
      await storage.remove('temp');
      const result = await storage.get<string>('temp');
      expect(result).toBeNull();
    });

    it('should overwrite an existing value', async () => {
      await storage.set('key', 'old');
      await storage.set('key', 'new');
      const result = await storage.get<string>('key');
      expect(result).toBe('new');
    });
  });

  describe('remove', () => {
    it('should remove an existing key', async () => {
      await storage.set('to-remove', 'data');
      await storage.remove('to-remove');
      const result = await storage.get<string>('to-remove');
      expect(result).toBeNull();
    });

    it('should not throw when removing a non-existent key', async () => {
      await expect(storage.remove('ghost')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all revival-prefixed keys', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      await storage.set('c', 3);
      await storage.clear();

      const a = await storage.get<number>('a');
      const b = await storage.get<number>('b');
      const c = await storage.get<number>('c');
      expect(a).toBeNull();
      expect(b).toBeNull();
      expect(c).toBeNull();
    });

    it('should not clear non-revival localStorage keys', async () => {
      localStorage.setItem('other-key', 'should remain');
      await storage.set('revival-key', 'data');
      await storage.clear();

      expect(localStorage.getItem('other-key')).toBe('should remain');
    });
  });

  describe('edge cases', () => {
    it('should handle null values', async () => {
      await storage.set<null>('null-key', null);
      const result = await storage.get<null>('null-key');
      expect(result).toBeNull();
    });

    it('should handle undefined values gracefully', async () => {
      // JSON.stringify(undefined) returns undefined, which would store "undefined" string
      // This is a known edge case - the value stored would be the string "undefined"
      await storage.set('undef', undefined as unknown as null);
      const result = await storage.get<string>('undef');
      expect(result).toBeNull(); // JSON.parse(JSON.stringify(undefined)) via localStorage returns null
    });

    it('should use correct localStorage prefix', async () => {
      await storage.set('prefixed', 'value');
      // Check that the key is stored with the prefix in actual localStorage
      const raw = localStorage.getItem('revival:prefixed');
      expect(raw).toBe('"value"');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  createStorage Factory Tests                                        */
/* ------------------------------------------------------------------ */

describe('createStorage() factory function', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return a StorageService instance in web environment', () => {
    window.electronAPI = undefined;
    const s = createStorage();
    expect(s).toBeDefined();
    expect(typeof s.get).toBe('function');
    expect(typeof s.set).toBe('function');
    expect(typeof s.remove).toBe('function');
    expect(typeof s.clear).toBe('function');
  });

  it('should work correctly end-to-end as a StorageService', async () => {
    const s = createStorage();
    await s.set('e2e', { test: true });
    const result = await s.get<{ test: boolean }>('e2e');
    expect(result).toEqual({ test: true });
  });

  it('should allow multiple independent instances', async () => {
    const s1 = createStorage();
    const s2 = createStorage();

    await s1.set('instance-key', 'from-s1');
    const v1 = await s1.get<string>('instance-key');
    const v2 = await s2.get<string>('instance-key');

    // Both instances share the same localStorage, so they see each other's data
    expect(v1).toBe('from-s1');
    expect(v2).toBe('from-s1');
  });
});

/* ------------------------------------------------------------------ */
/*  Type Safety Tests (compile-time checks)                            */
/* ------------------------------------------------------------------ */

describe('StorageService interface type safety', () => {
  it('should satisfy async contract', () => {
    const s = createStorage();
    // All methods return promises
    expect(s.get('x')).toBeInstanceOf(Promise);
    expect(s.set('x', 'y')).toBeInstanceOf(Promise);
    expect(s.remove('x')).toBeInstanceOf(Promise);
    expect(s.clear()).toBeInstanceOf(Promise);
  });

  it('should accept generic type parameter', async () => {
    const s = createStorage();
    // TypeScript checks at compile time — runtime test confirms functionality
    await s.set('num', 100);
    const val = await s.get<number>('num');
    expect(typeof val).toBe('number');
    expect(val).toBe(100);
  });
});
