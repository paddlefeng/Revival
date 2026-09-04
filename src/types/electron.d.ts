/**
 * Electron API 类型声明
 * Revival - 为渲染进程暴露的原生能力提供完整类型
 */

/* ------------------------------------------------------------------ */
/*  通用类型                                                           */
/* ------------------------------------------------------------------ */

export interface DialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface ImageProcessResult {
  data: string;      // base64 编码的图片数据
  mimeType: string;  // 如 image/png, image/jpeg
}

export type SharpOperation = 'resize' | 'convert' | 'metadata' | 'compress' | 'thumbnail';

export interface SharpProcessOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format?: 'png' | 'jpeg' | 'webp' | 'heif';
  formatOptions?: Record<string, unknown>;
  quality?: number;
  size?: number;
}

/* ------------------------------------------------------------------ */
/*  EXIF / 元数据                                                      */
/* ------------------------------------------------------------------ */

export interface ExifData {
  Make?: string;
  Model?: string;
  FNumber?: number;
  ExposureTime?: string;
  ISO?: number;
  FocalLength?: number;
  DateTimeOriginal?: string;
  LensModel?: string;
}

/* ------------------------------------------------------------------ */
/*  自动更新类型                                                       */
/* ------------------------------------------------------------------ */

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

/* ------------------------------------------------------------------ */
/*  Electron API 接口                                                  */
/* ------------------------------------------------------------------ */

export interface ElectronAPI {
  // ---- 窗口控制 ----
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onWindowStateChanged: (callback: (isMaximized: boolean) => void) => void;

  // ---- 原生对话框 ----
  showOpenDialog: (options: Record<string, unknown>) => Promise<DialogResult>;
  showSaveDialog: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePath?: string }>;

  // ---- Sharp 图片处理 ----
  processImage: (
    operation: SharpOperation,
    inputPath: string,
    options?: SharpProcessOptions,
  ) => Promise<ImageProcessResult>;

  // ---- 任务栏进度 ----
  setProgressBar: (progress: number) => void;
  clearProgressBar: () => void;

  // ---- 应用信息 ----
  getAppVersion: () => Promise<string>;
  getAppPath: () => Promise<string>;

  // ---- 自动更新事件 ----
  onUpdateChecking: (callback: () => void) => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateNotAvailable: (callback: () => void) => void;
  onUpdateProgress: (callback: (progress: UpdateProgress) => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;

  // ---- 导航事件 ----
  onNavigate: (callback: (route: string) => void) => void;

  // ---- 文件事件 ----
  onFilesOpened: (callback: (files: string[]) => void) => void;
  onExportImage: (callback: () => void) => void;
  onBatchExport: (callback: () => void) => void;
  onOpenSettings: (callback: () => void) => void;
}

/* ------------------------------------------------------------------ */
/*  Window 扩展                                                        */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    capacitorAPI?: {
      isNative: boolean;
      platform: string;
    };
  }
}
