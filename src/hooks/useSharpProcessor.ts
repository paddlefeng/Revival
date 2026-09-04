/**
 * useSharpProcessor - 原生图片处理 Hook
 * Electron 端使用 Sharp（IPC），Web/Android 端 fallback 到 Canvas API
 */

import { useState, useCallback } from 'react';
import { isElectron } from '../platform';
import type { SharpOperation, SharpProcessOptions, ImageProcessResult } from '../types/electron';

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

export interface UseSharpProcessorReturn {
  /** 执行图片处理 */
  processImage: (operation: SharpOperation, inputPath: string, options?: SharpProcessOptions) => Promise<ImageProcessResult | null>;
  /** 是否正在处理 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 最近一次处理结果 */
  result: ImageProcessResult | null;
  /** 清除结果 */
  clearResult: () => void;
}

/* ------------------------------------------------------------------ */
/*  Canvas fallback 辅助函数                                           */
/* ------------------------------------------------------------------ */

/**
 * Canvas 端 resize 实现
 */
function canvasResize(
  img: HTMLImageElement,
  width?: number,
  height?: number,
  _fit?: string,
): Promise<ImageProcessResult> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    let targetW = img.width;
    let targetH = img.height;

    if (width && height) {
      targetW = width;
      targetH = height;
    } else if (width) {
      const ratio = width / img.width;
      targetW = width;
      targetH = Math.round(img.height * ratio);
    } else if (height) {
      const ratio = height / img.height;
      targetH = height;
      targetW = Math.round(img.width * ratio);
    }

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve({ data: '', mimeType: 'image/png' });
      return;
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const mimeType = 'image/png';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve({ data: '', mimeType });
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ data: (reader.result as string).split(',')[1], mimeType });
        };
        reader.readAsDataURL(blob);
      },
      mimeType,
    );
  });
}

/**
 * Canvas 端 convert 实现
 */
function canvasConvert(
  img: HTMLImageElement,
  format?: string,
): Promise<ImageProcessResult> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve({ data: '', mimeType: 'image/png' });
      return;
    }

    ctx.drawImage(img, 0, 0);

    const mimeType = format ? `image/${format}` : 'image/png';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve({ data: '', mimeType });
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ data: (reader.result as string).split(',')[1], mimeType });
        };
        reader.readAsDataURL(blob);
      },
      mimeType,
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useSharpProcessor(): UseSharpProcessorReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageProcessResult | null>(null);

  const processImage = useCallback(
    async (
      operation: SharpOperation,
      inputPath: string,
      options?: SharpProcessOptions,
    ): Promise<ImageProcessResult | null> => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        // Electron: 使用 Sharp IPC
        if (isElectron() && window.electronAPI) {
          const res = await window.electronAPI.processImage(operation, inputPath, options);
          setResult(res);
          return res;
        }

        // Web/Android: Canvas fallback
        const img = await loadImage(inputPath);

        let canvasResult: ImageProcessResult;

        switch (operation) {
          case 'resize':
            canvasResult = await canvasResize(img, options?.width, options?.height, options?.fit);
            break;
          case 'convert':
            canvasResult = await canvasConvert(img, options?.format);
            break;
          case 'metadata': {
            // Canvas 无法获取完整 metadata，返回基本信息
            canvasResult = {
              data: '',
              mimeType: 'image/png',
            };
            break;
          }
          case 'compress': {
            // 用 canvas 重绘实现压缩
            canvasResult = await canvasConvert(img, 'jpeg');
            break;
          }
          case 'thumbnail': {
            const size = options?.size || 300;
            canvasResult = await canvasResize(img, size, size, 'cover');
            break;
          }
          default:
            throw new Error(`Unsupported operation in Canvas fallback: ${operation}`);
        }

        setResult(canvasResult);
        return canvasResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : '图片处理失败';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    processImage,
    loading,
    error,
    result,
    clearResult,
  };
}

/**
 * 加载图片为 HTMLImageElement（支持 data URL 和路径）
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
