/**
 * ResponsiveLayout 响应式布局容器测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ResponsiveLayout } from './ResponsiveLayout';

// Mock useResponsive
vi.mock('../hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));

import { useResponsive } from '../hooks/useResponsive';
import type { Mock } from 'vitest';

const mockedUseResponsive = vi.mocked(useResponsive);

describe('ResponsiveLayout', () => {
  // Create mock responsive info helper
  function createMockResponsive(overrides: Partial<ReturnType<typeof useResponsive>> = {}) {
    return {
      breakpoint: 'desktop' as const,
      platform: 'web' as const,
      isTouch: false,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1440,
      height: 900,
      orientation: 'landscape' as const,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockedUseResponsive.mockReturnValue(createMockResponsive());
  });

  describe('桌面端渲染', () => {
    it('should render preview and controls in desktop layout', () => {
      mockedUseResponsive.mockReturnValue(createMockResponsive({ isMobile: false, isDesktop: true }));

      render(
        <ResponsiveLayout
          preview={<div data-testid="preview">Preview</div>}
          controls={<div data-testid="controls">Controls</div>}
        />,
      );

      expect(screen.getByTestId('preview')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
    });

    it('should use wide panel class when widePanel is true', () => {
      mockedUseResponsive.mockReturnValue(createMockResponsive({ isMobile: false }));

      const { container } = render(
        <ResponsiveLayout
          widePanel={true}
          preview={<div>Preview</div>}
          controls={<div>Controls</div>}
        />,
      );

      const layoutEl = container.querySelector('.editor-layout');
      expect(layoutEl).toBeInTheDocument();
      expect(layoutEl!.classList.contains('wide-panel')).toBe(true);
    });

    it('should not use wide panel class when widePanel is false', () => {
      mockedUseResponsive.mockReturnValue(createMockResponsive({ isMobile: false }));

      const { container } = render(
        <ResponsiveLayout
          widePanel={false}
          preview={<div>Preview</div>}
          controls={<div>Controls</div>}
        />,
      );

      const layoutEl = container.querySelector('.editor-layout');
      expect(layoutEl).toBeInTheDocument();
      expect(layoutEl!.classList.contains('wide-panel')).toBe(false);
    });

    it('should render desktop layout with correct structure', () => {
      mockedUseResponsive.mockReturnValue(createMockResponsive({ isMobile: false, isDesktop: true }));

      const { container } = render(
        <ResponsiveLayout
          preview={<div>Preview</div>}
          controls={<div>Controls</div>}
        />,
      );

      expect(container.querySelector('.editor-layout')).toBeInTheDocument();
      expect(container.querySelector('.editor-preview-area')).toBeInTheDocument();
      expect(container.querySelector('.editor-control-panel')).toBeInTheDocument();
    });
  });

  describe('平板端渲染', () => {
    it('should render desktop/tablet layout when isTablet', () => {
      mockedUseResponsive.mockReturnValue(createMockResponsive({
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        breakpoint: 'tablet',
        width: 800,
      }));

      render(
        <ResponsiveLayout
          preview={<div data-testid="preview">Preview</div>}
          controls={<div data-testid="controls">Controls</div>}
        />,
      );

      expect(screen.getByTestId('preview')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
      // Should use editor-layout (same as desktop)
      expect(document.querySelector('.editor-layout')).toBeInTheDocument();
    });
  });

  describe('手机端渲染', () => {
    beforeEach(() => {
      mockedUseResponsive.mockReturnValue(createMockResponsive({
        isMobile: true,
        isDesktop: false,
        isTablet: false,
        breakpoint: 'mobile',
        width: 375,
        height: 667,
      }));
    });

    it('should render mobile layout with drawer', () => {
      render(
        <ResponsiveLayout
          preview={<div data-testid="preview">Preview</div>}
          controls={<div data-testid="controls">Controls</div>}
          drawerTitle="图片参数"
        />,
      );

      expect(screen.getByTestId('preview')).toBeInTheDocument();
      // Should show the parameter button
      expect(screen.getByText('⚙ 参数调节')).toBeInTheDocument();
    });

    it('should apply correct CSS classes for mobile layout', () => {
      const { container } = render(
        <ResponsiveLayout
          preview={<div>Preview</div>}
          controls={<div>Controls</div>}
        />,
      );

      // Mobile uses flex-col layout
      const flexCol = container.querySelector('.flex.flex-col');
      expect(flexCol).toBeInTheDocument();
    });

    it('should render FAB when provided on mobile', () => {
      render(
        <ResponsiveLayout
          preview={<div>Preview</div>}
          controls={<div>Controls</div>}
          fab={<button data-testid="fab">Action</button>}
        />,
      );

      expect(screen.getByTestId('fab')).toBeInTheDocument();
    });

    it('should render drawer with drawerTitle', () => {
      render(
        <ResponsiveLayout
          preview={<div>Preview</div>}
          controls={<div>Controls</div>}
          drawerTitle="编辑参数"
        />,
      );

      // Drawer is initially closed, but clicking the button opens it
      const drawerBtn = screen.getByText('⚙ 参数调节');
      act(() => {
        drawerBtn.click();
      });

      expect(screen.getByText('编辑参数')).toBeInTheDocument();
    });

    it('should render drawer action button when drawerActionLabel and onDrawerAction provided', () => {
      const onAction = vi.fn();
      render(
        <ResponsiveLayout
          preview={<div>Preview</div>}
          controls={<div>Controls</div>}
          drawerTitle="参数"
          drawerActionLabel="应用"
          onDrawerAction={onAction}
        />,
      );

      // Open drawer
      act(() => {
        screen.getByText('⚙ 参数调节').click();
      });

      const actionBtn = screen.getByText('应用');
      expect(actionBtn).toBeInTheDocument();

      act(() => {
        actionBtn.click();
      });
      expect(onAction).toHaveBeenCalled();
    });
  });
});
