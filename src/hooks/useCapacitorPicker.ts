/**
 * useCapacitorPicker - Capacitor 原生文件选择 Hook
 * Android 端使用 @capacitor/filesystem，Web 端 fallback 到 <input type="file">
 */

import { useRef, useCallback } from 'react';
import { isAndroid, detectPlatform } from '../platform';

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

export interface PickedFile {
  name: string;
  dataUrl: string;
  /** 原始 File 对象（Web 端可用） */
  file: File | null;
}

export interface MediaUploadResult {
  files: PickedFile[];
  isVideo: boolean;
}

export interface CapacitorPickerOptions {
  accept?: string;
  multiple?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * Capacitor 原生文件选择 Hook
 *
 * @example
 * ```tsx
 * const { pickMedia, isSupported } = useCapacitorPicker();
 * const result = await pickMedia({ accept: 'image/*', multiple: true });
 * ```
 */
export function useCapacitorPicker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const platform = detectPlatform();
  const supported = platform === 'android' || platform === 'ios';

  const pickMedia = useCallback(
    async (options?: CapacitorPickerOptions): Promise<MediaUploadResult | null> => {
      const accept = options?.accept ?? 'image/*';
      const multiple = options?.multiple ?? false;

      if (isAndroid() || platform === 'ios') {
        return pickViaCapacitor(accept, multiple);
      }

      // Web fallback
      return pickViaFileInput(accept, multiple);
    },
    [platform],
  );

  return {
    pickMedia,
    isSupported: supported,
    /** 用于 Web fallback 的隐藏 file input ref */
    fileInputRef,
  };
}

/* ------------------------------------------------------------------ */
/*  Capacitor 实现                                                     */
/* ------------------------------------------------------------------ */

async function pickViaCapacitor(_accept: string, multiple: boolean): Promise<MediaUploadResult | null> {
  try {
    const { Filesystem } = await import('@capacitor/filesystem');

    // Capacitor 没有直接的文件选择器 API，我们需要通过文件输入
    // 或者使用 @capacitor/dialog 但这里我们用更简单的方式
    // 实际上 Capacitor 可以通过 Intent 打开文件选择器
    // 这里创建一个隐藏的 input 标签来实现
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = _accept;
      input.multiple = multiple;
      input.style.display = 'none';

      input.addEventListener('change', async () => {
        const fileList = input.files;
        if (!fileList || !fileList.length) {
          resolve(null);
          return;
        }

        const filesArray = Array.from(fileList);
        const isVideo = filesArray[0].type.startsWith('video');

        const results: PickedFile[] = [];

        for (const file of filesArray) {
          try {
            // 尝试用 Capacitor Filesystem 读取文件
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolveReader) => {
              reader.onload = () => resolveReader(reader.result as string);
              reader.readAsDataURL(file);
            });
            results.push({
              name: file.name,
              dataUrl,
              file,
            });
          } catch (err) {
            console.error('[CapacitorPicker] read file error:', err);
          }
        }

        document.body.removeChild(input);
        resolve({ files: results, isVideo });
      });

      input.addEventListener('cancel', () => {
        document.body.removeChild(input);
        resolve(null);
      });

      document.body.appendChild(input);
      input.click();
    });
  } catch (err) {
    console.error('[CapacitorPicker] error:', err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Web fallback 实现                                                  */
/* ------------------------------------------------------------------ */

function pickViaFileInput(accept: string, multiple: boolean): Promise<MediaUploadResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const fileList = input.files;
      if (!fileList || !fileList.length) {
        resolve(null);
        return;
      }

      const filesArray = Array.from(fileList);
      const isVideo = filesArray[0].type.startsWith('video');

      const promises = filesArray.map(
        (file) =>
          new Promise<PickedFile>((resolveFile) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolveFile({ name: file.name, dataUrl: reader.result as string, file });
            reader.readAsDataURL(file);
          }),
      );

      Promise.all(promises).then((results) => {
        document.body.removeChild(input);
        resolve({ files: results, isVideo });
      });
    });

    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
}
