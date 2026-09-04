// src/hooks/useUndoRedo.ts
import { useCallback, useRef, useState } from "react";

export function useUndoRedo<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<T[]>([initialState]);
  const currentIndexRef = useRef(0);

  const setValue = useCallback((newState: T | ((prev: T) => T)) => {
    const nextState = typeof newState === 'function' ? (newState as (prev: T) => T)(state) : newState;
    // 如果值没有变化，不记录历史
    if (JSON.stringify(nextState) === JSON.stringify(state)) return;

    // 删除当前位置之后的历史记录
    historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
    historyRef.current.push(nextState);
    currentIndexRef.current++;
    setState(nextState);
  }, [state]);

  const undo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current--;
      setState(historyRef.current[currentIndexRef.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current++;
      setState(historyRef.current[currentIndexRef.current]);
    }
  }, []);

  const canUndo = currentIndexRef.current > 0;
  const canRedo = currentIndexRef.current < historyRef.current.length - 1;

  // 重置历史记录（例如切换模板或加载新参数时）
  const resetHistory = useCallback((newState: T) => {
    historyRef.current = [newState];
    currentIndexRef.current = 0;
    setState(newState);
  }, []);

  return { state, setValue, undo, redo, canUndo, canRedo, resetHistory };
}