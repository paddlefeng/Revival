/**
 * MobileDrawer 手机端可拖拽底部参数抽屉测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MobileDrawer } from './MobileDrawer';

describe('MobileDrawer', () => {
  const defaultProps = {
    open: false,
    onOpenChange: vi.fn(),
    title: '参数设置',
    children: <div data-testid="drawer-content">Content</div>,
  };

  beforeEach(() => {
    defaultProps.onOpenChange = vi.fn();
  });

  describe('基本渲染', () => {
    it('should render with title when closed', () => {
      render(<MobileDrawer {...defaultProps} />);
      expect(screen.getByText('参数设置')).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(<MobileDrawer {...defaultProps} />);
      expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
    });

    it('should render with title when open', () => {
      render(<MobileDrawer {...defaultProps} open={true} />);
      expect(screen.getByText('参数设置')).toBeInTheDocument();
    });
  });

  describe('操作按钮', () => {
    it('should render action button when actionLabel is provided', () => {
      render(<MobileDrawer {...defaultProps} actionLabel="应用" onAction={vi.fn()} />);
      expect(screen.getByText('应用')).toBeInTheDocument();
    });

    it('should not render action button when actionLabel is not provided', () => {
      render(<MobileDrawer {...defaultProps} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should call onAction when action button is clicked', () => {
      const onAction = vi.fn();
      render(<MobileDrawer {...defaultProps} actionLabel="应用" onAction={onAction} />);

      act(() => {
        screen.getByText('应用').click();
      });
      expect(onAction).toHaveBeenCalled();
    });
  });

  describe('拖拽功能', () => {
    it('should handle pointer down event', () => {
      render(<MobileDrawer {...defaultProps} open={true} />);

      const handle = screen.getByText('参数设置').closest('.flex.items-center')?.previousElementSibling as HTMLElement;
      // The touch-target div contains the handle
      const touchTarget = document.querySelector('.touch-target');
      expect(touchTarget).toBeInTheDocument();

      if (touchTarget) {
        act(() => {
          fireEvent.pointerDown(touchTarget, { clientX: 0, clientY: 100, pointerId: 1 });
        });
      }
    });

    it('should have grab cursor on handle', () => {
      render(<MobileDrawer {...defaultProps} />);

      const handle = document.querySelector('.touch-target') as HTMLElement;
      expect(handle).toBeInTheDocument();
      expect(handle.style.cursor).toBe('grab');
    });

    it('should have touch-action: none on drag handle', () => {
      render(<MobileDrawer {...defaultProps} />);
      const touchTarget = document.querySelector('.touch-target') as HTMLElement;
      expect(touchTarget.style.touchAction).toBe('none');
    });

    it('should render the drawer with mobile-drawer class', () => {
      const { container } = render(<MobileDrawer {...defaultProps} />);
      expect(container.querySelector('.mobile-drawer')).toBeInTheDocument();
    });

    it('should render the handle element', () => {
      render(<MobileDrawer {...defaultProps} />);
      expect(document.querySelector('.mobile-drawer-handle')).toBeInTheDocument();
    });
  });

  describe('键盘交互', () => {
    it('should close on Escape key when open', () => {
      const onOpenChange = vi.fn();
      render(<MobileDrawer {...defaultProps} open={true} onOpenChange={onOpenChange} />);

      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should not close on Escape key when closed', () => {
      const onOpenChange = vi.fn();
      render(<MobileDrawer {...defaultProps} open={false} onOpenChange={onOpenChange} />);

      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('高度状态', () => {
    it('should use MIN height when closed', () => {
      const { container } = render(<MobileDrawer {...defaultProps} open={false} />);
      const drawer = container.querySelector('.mobile-drawer') as HTMLElement;
      expect(drawer).toBeInTheDocument();
      // MIN_DRAWER_HEIGHT = 60vh
      expect(drawer.style.height).toBe('60vh');
    });

    it('should use MAX height when open', () => {
      const { container } = render(<MobileDrawer {...defaultProps} open={true} />);
      const drawer = container.querySelector('.mobile-drawer') as HTMLElement;
      expect(drawer).toBeInTheDocument();
      // MAX_DRAWER_HEIGHT = 80vh
      expect(drawer.style.height).toBe('80vh');
    });
  });
});
