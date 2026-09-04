/**
 * ResponsiveLayout - 响应式布局容器
 * 自动适配桌面/平板/手机三种断点
 */

import { useState, type ReactNode } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { MobileDrawer } from './MobileDrawer';

interface ResponsiveLayoutProps {
  /** 模板标识 */
  template?: string;
  /** 是否宽面板 (560px vs 400px) */
  widePanel?: boolean;
  /** 预览区域内容 */
  preview: ReactNode;
  /** 控制面板内容（桌面/平板侧栏） */
  controls: ReactNode;
  /** 手机端抽屉标题 */
  drawerTitle?: string;
  /** 手机端抽屉操作按钮文字 */
  drawerActionLabel?: string;
  /** 手机端抽屉操作回调 */
  onDrawerAction?: () => void;
  /** 手机端浮动操作按钮 */
  fab?: ReactNode;
}

export function ResponsiveLayout({
  widePanel = false,
  preview,
  controls,
  drawerTitle = '参数',
  drawerActionLabel,
  onDrawerAction,
  fab,
}: ResponsiveLayoutProps) {
  const responsive = useResponsive();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 桌面/平板: 网格布局
  if (!responsive.isMobile) {
    return (
      <div className={`editor-layout ${widePanel ? 'wide-panel' : ''}`}>
        <div className="editor-preview-area relative flex items-center justify-center overflow-auto bg-[#0b1220]">
          {preview}
        </div>
        <div className="editor-control-panel overflow-y-auto border-l border-white/10 bg-white/[0.03] backdrop-blur-2xl p-4 lg:p-6 scrollbar-thin scrollbar-thumb-white/10">
          {controls}
        </div>
      </div>
    );
  }

  // 手机端: 全屏预览 + 底部抽屉
  return (
    <div className="flex flex-col h-full">
      {/* 全屏预览 */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#0b1220]">
        {preview}
      </div>

      {/* 浮动 FAB */}
      {fab && (
        <div className="absolute bottom-4 right-4 z-40">
          {fab}
        </div>
      )}

      {/* 底部参数入口按钮 */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="absolute bottom-4 left-4 z-40 touch-button px-4 rounded-xl bg-white/10 backdrop-blur-md text-white text-sm border border-white/20"
      >
        ⚙ 参数调节
      </button>

      {/* 底部抽屉 */}
      <MobileDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerTitle}
        actionLabel={drawerActionLabel}
        onAction={onDrawerAction}
      >
        {controls}
      </MobileDrawer>
    </div>
  );
}
