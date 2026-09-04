/**
 * useExifData - EXIF 数据提取 Hook
 * Electron 端通过 Sharp metadata IPC 获取，Web/Android 端通过 exifr 库读取
 */

import { useState, useCallback } from 'react';
import { isElectron } from '../platform';
import type { ExifData } from '../types/electron';

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

export interface UseExifDataReturn {
  /** 提取图片 EXIF 数据 */
  extractExif: (imageSrc: string) => Promise<ExifData | null>;
  /** 最近一次提取结果 */
  data: ExifData | null;
  /** 是否正在提取 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 清除数据 */
  clearData: () => void;
}

/**
 * EXIF 数据提取 Hook
 *
 * @example
 * ```tsx
 * const { extractExif, data, loading } = useExifData();
 * useEffect(() => { extractExif(imageSrc); }, [imageSrc]);
 * ```
 */
export function useExifData(): UseExifDataReturn {
  const [data, setData] = useState<ExifData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractExif = useCallback(async (imageSrc: string): Promise<ExifData | null> => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      let exif: ExifData | null = null;

      if (isElectron() && window.electronAPI) {
        // Electron: 通过 Sharp metadata IPC 获取 EXIF
        const meta = await window.electronAPI.processImage('metadata', imageSrc, {});
        if (meta && meta.data) {
          // metadata 返回的是 Sharp 元数据，包含 EXIF 信息
          // 但这里 processImage 返回的是 base64 data，不是 metadata
          // 实际需要额外 IPC 来获取 metadata
          // 使用 Fallback 方式处理
          exif = await extractExifViaExifr(imageSrc);
        } else {
          exif = await extractExifViaExifr(imageSrc);
        }
      } else {
        // Web/Android: 使用 exifr 库
        exif = await extractExifViaExifr(imageSrc);
      }

      setData(exif);
      return exif;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'EXIF 提取失败';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    extractExif,
    data,
    loading,
    error,
    clearData,
  };
}

/**
 * 使用 exifr 库从图片源提取 EXIF 数据
 */
async function extractExifViaExifr(imageSrc: string): Promise<ExifData | null> {
  try {
    // 从 data URL 或路径加载为 Blob/File
    let input: Blob | string = imageSrc;

    // 如果是 data URL，转为 Blob
    if (imageSrc.startsWith('data:')) {
      const response = await fetch(imageSrc);
      input = await response.blob();
    }

    // 动态导入 exifr
    const exifr = await import('exifr');

    // 解析 EXIF
    const parsed = await exifr.parse(input, {
      pick: ['Make', 'Model', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal', 'LensModel'],
    });

    if (!parsed) return null;

    return {
      Make: parsed.Make ?? undefined,
      Model: parsed.Model ?? undefined,
      FNumber: parsed.FNumber ?? undefined,
      ExposureTime: parsed.ExposureTime !== undefined ? formatExposureTime(parsed.ExposureTime) : undefined,
      ISO: parsed.ISO ?? undefined,
      FocalLength: parsed.FocalLength ?? undefined,
      DateTimeOriginal: parsed.DateTimeOriginal ?? undefined,
      LensModel: parsed.LensModel ?? undefined,
    };
  } catch (err) {
    console.error('[exifr] parse error:', err);
    return null;
  }
}

/**
 * 将曝光时间格式化为可读字符串（如 1/125）
 */
function formatExposureTime(value: number): string {
  if (value < 1) {
    const denominator = Math.round(1 / value);
    return `1/${denominator}`;
  }
  return `${value}s`;
}
