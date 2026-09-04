/**
 * MobileDrawer - 手机端可拖拽底部参数抽屉
 * 类似 iOS 照片编辑的底部面板，支持触摸拖动展开/收起
 */

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

const DRAWER_THRESHOLD = 30; // 拖拽切换阈值 (px)
const MIN_DRAWER_HEIGHT = 60; // 收起时高度 (vh)
const MAX_DRAWER_HEIGHT = 80; // 展开时高度 (vh)

export function MobileDrawer({ open, onOpenChange, title, actionLabel, onAction, children }: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(open ? MAX_DRAWER_HEIGHT : MIN_DRAWER_HEIGHT);

  useEffect(() => {
    setDrawerHeight(open ? MAX_DRAWER_HEIGHT : MIN_DRAWER_HEIGHT);
  }, [open]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startY.current = e.clientY;
    currentY.current = e.clientY;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    currentY.current = e.clientY;
    const delta = startY.current - currentY.current;

    // 计算新的高度
    const baseHeight = open ? MAX_DRAWER_HEIGHT : MIN_DRAWER_HEIGHT;
    const deltaVh = (delta / window.innerHeight) * 100;
    const newHeight = Math.max(MIN_DRAWER_HEIGHT, Math.min(MAX_DRAWER_HEIGHT, baseHeight + deltaVh));
    setDrawerHeight(newHeight);
  }, [isDragging, open]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const delta = startY.current - currentY.current;

    if (Math.abs(delta) > DRAWER_THRESHOLD) {
      onOpenChange(delta > 0);
    } else {
      // 回弹
      setDrawerHeight(open ? MAX_DRAWER_HEIGHT : MIN_DRAWER_HEIGHT);
    }
  }, [isDragging, open, onOpenChange]);

  // 键盘支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <div
      ref={drawerRef}
      className="mobile-drawer"
      style={{
        height: `${drawerHeight}vh`,
        transform: isDragging ? 'none' : undefined,
        willChange: 'transform, height',
        transition: isDragging ? 'none' : 'height 0.3s ease',
      }}
    >
      {/* 拖拽手柄 */}
      <div
        className="touch-target"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: 'grab', touchAction: 'none' }}
      >
        <div className="mobile-drawer-handle" />
      </div>

      {/* 头部 */}
      <div className="flex items-center justify-between px-4 pb-2">
        <h2 className="text-white font-medium text-sm">{title}</h2>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="touch-button px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm"
          >
            {actionLabel}
          </button>
        )}
      </div>

      {/* 可滚动内容 */}
      <div className="px-4 pb-6 overflow-y-auto safe-bottom" style={{ maxHeight: 'calc(100% - 60px)' }}>
        {children}
      </div>
    </div>
  );
}
