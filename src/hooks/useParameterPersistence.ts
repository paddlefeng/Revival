import { useEffect, useCallback } from "react";

export function useParameterPersistence<T>(key: string, params: T, onLoad: (loaded: T) => void) {
  // 自动保存 (防抖)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(params));
    }, 500);
    return () => clearTimeout(timer);
  }, [params, key]);

  // 加载保存的参数
  const loadSaved = useCallback(() => {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onLoad(parsed);
      } catch (e) {}
    }
  }, [key, onLoad]);

  // 导出参数文件
  const exportToFile = useCallback(() => {
    const dataStr = JSON.stringify(params, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${key}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [params, key]);

  // 从文件导入
  const importFromFile = useCallback((file: File, onSuccess?: () => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loaded = JSON.parse(e.target?.result as string);
        onLoad(loaded);
        onSuccess?.();
      } catch (err) {
        alert("解析文件失败");
      }
    };
    reader.readAsText(file);
  }, [onLoad]);

  return { loadSaved, exportToFile, importFromFile };
}