// src/utils/batchExport.ts
import JSZip from 'jszip';

export interface BatchProgress {
  current: number;
  total: number;
  status: 'processing' | 'completed' | 'cancelled';
}

/**
 * 批量处理图片文件
 * @param files 图片文件列表
 * @param renderFunc 单张图片渲染函数，输入图片的 dataURL，输出 Blob
 * @param onProgress 进度回调
 * @param signal 用于取消的 AbortSignal
 * @returns 渲染后的 Blob 数组
 */
export async function batchProcess(
  files: File[],
  renderFunc: (imageUrl: string) => Promise<Blob>,
  onProgress: (progress: BatchProgress) => void,
  signal?: AbortSignal
): Promise<Blob[]> {
  const results: Blob[] = [];
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) {
      onProgress({ current: i, total: files.length, status: 'cancelled' });
      break;
    }
    onProgress({ current: i, total: files.length, status: 'processing' });
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(files[i]);
    });
    const blob = await renderFunc(dataUrl);
    results.push(blob);
  }
  if (results.length === files.length && !signal?.aborted) {
    onProgress({ current: files.length, total: files.length, status: 'completed' });
  }
  return results;
}

/**
 * 批量下载为 ZIP 压缩包
 * @param results Blob 数组
 * @param baseName 文件名前缀（压缩包名称）
 */
export async function downloadBatchAsZip(results: Blob[], baseName: string = 'batch'): Promise<void> {
  const zip = new JSZip();
  for (let i = 0; i < results.length; i++) {
    zip.file(`${baseName}_${i + 1}.png`, results[i]);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}