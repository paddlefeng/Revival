/**
 * 平台感知的媒体上传组件
 * Desktop: 使用 Electron 原生文件对话框
 * Mobile: 使用 Capacitor 文件选择器
 */

import { useRef, useCallback } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { isElectron, isMobile } from '../platform';

interface MediaUploadResult {
  files: { name: string; dataUrl: string; file: File }[];
  isVideo: boolean;
}

interface UsePlatformUploadOptions {
  onUpload: (result: MediaUploadResult) => void;
  acceptVideo?: boolean;
  multiple?: boolean;
}

export function usePlatformUpload({ onUpload, acceptVideo = true, multiple = false }: UsePlatformUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const responsive = useResponsive();

  const triggerUpload = useCallback(() => {
    if (isElectron() && window.electronAPI) {
      // Electron: 使用原生文件对话框
      window.electronAPI.showOpenDialog({
        properties: ['openFile', multiple ? 'multiSelections' : 'openFile'].filter(Boolean),
        filters: [
          { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'heic', 'webp', 'bmp', 'tiff'] },
          ...(acceptVideo ? [{ name: '视频', extensions: ['mp4', 'mov', 'avi', 'mkv'] }] : []),
        ],
      }).then(async (result: any) => {
        if (result.canceled || !result.filePaths.length) return;
        // Electron 端只能拿到路径，需要在渲染进程读取
        // 这里仍然 fallback 到 file input 方式
        fileInputRef.current?.click();
      });
    } else {
      fileInputRef.current?.click();
    }
  }, [multiple, acceptVideo]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || !fileList.length) return;

    const filesArray = Array.from(fileList);
    const isVideo = filesArray[0].type.startsWith('video');
    const promises = filesArray.map(file => {
      return new Promise<{ name: string; dataUrl: string; file: File }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, dataUrl: reader.result as string, file });
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(results => {
      onUpload({ files: results, isVideo });
    });

    // 重置 input 以允许重复选择同一文件
    e.target.value = '';
  }, [onUpload]);

  const renderFileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      accept={acceptVideo ? 'image/*,video/*' : 'image/*'}
      multiple={multiple}
      onChange={handleFileChange}
      className="hidden"
    />
  );

  return {
    triggerUpload,
    handleFileChange,
    renderFileInput,
    isMobile: responsive.isMobile,
    isTouch: responsive.isTouch,
  };
}
