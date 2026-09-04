/**
 * PlatformGuard 平台守卫组件测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformGuard } from './PlatformGuard';
import { detectPlatform } from '../platform';

// Mock detectPlatform
vi.mock('../platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../platform')>();
  return {
    ...actual,
    detectPlatform: vi.fn(),
  };
});

const mockedDetectPlatform = vi.mocked(detectPlatform);

describe('PlatformGuard', () => {
  beforeEach(() => {
    mockedDetectPlatform.mockReset();
  });

  describe('单一平台匹配', () => {
    it('should render children when platform matches (electron)', () => {
      mockedDetectPlatform.mockReturnValue('electron');
      render(
        <PlatformGuard platform="electron">
          <div data-testid="electron-content">Electron Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('electron-content')).toBeInTheDocument();
      expect(screen.getByText('Electron Only')).toBeInTheDocument();
    });

    it('should not render children when platform does not match (electron vs web)', () => {
      mockedDetectPlatform.mockReturnValue('web');
      render(
        <PlatformGuard platform="electron">
          <div data-testid="electron-content">Electron Only</div>
        </PlatformGuard>,
      );
      expect(screen.queryByTestId('electron-content')).not.toBeInTheDocument();
    });

    it('should render children for android platform', () => {
      mockedDetectPlatform.mockReturnValue('android');
      render(
        <PlatformGuard platform="android">
          <div data-testid="android-content">Android Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('android-content')).toBeInTheDocument();
    });

    it('should render children for ios platform', () => {
      mockedDetectPlatform.mockReturnValue('ios');
      render(
        <PlatformGuard platform="ios">
          <div data-testid="ios-content">iOS Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('ios-content')).toBeInTheDocument();
    });

    it('should render children for web platform', () => {
      mockedDetectPlatform.mockReturnValue('web');
      render(
        <PlatformGuard platform="web">
          <div data-testid="web-content">Web Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('web-content')).toBeInTheDocument();
    });
  });

  describe('多平台数组匹配', () => {
    it('should render when current platform is in the array (android in [android, ios])', () => {
      mockedDetectPlatform.mockReturnValue('android');
      render(
        <PlatformGuard platform={['android', 'ios']}>
          <div data-testid="mobile-content">Mobile Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('mobile-content')).toBeInTheDocument();
    });

    it('should render when current platform is in the array (ios in [android, ios])', () => {
      mockedDetectPlatform.mockReturnValue('ios');
      render(
        <PlatformGuard platform={['android', 'ios']}>
          <div data-testid="mobile-content">Mobile Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('mobile-content')).toBeInTheDocument();
    });

    it('should not render when current platform is not in the array (web not in [android, ios])', () => {
      mockedDetectPlatform.mockReturnValue('web');
      render(
        <PlatformGuard platform={['android', 'ios']}>
          <div data-testid="mobile-content">Mobile Only</div>
        </PlatformGuard>,
      );
      expect(screen.queryByTestId('mobile-content')).not.toBeInTheDocument();
    });

    it('should not render when current platform is not in the array (electron not in [web])', () => {
      mockedDetectPlatform.mockReturnValue('electron');
      render(
        <PlatformGuard platform={['web']}>
          <div data-testid="web-content">Web Only</div>
        </PlatformGuard>,
      );
      expect(screen.queryByTestId('web-content')).not.toBeInTheDocument();
    });
  });

  describe('fallback 渲染', () => {
    it('should render fallback when platform does not match', () => {
      mockedDetectPlatform.mockReturnValue('web');
      render(
        <PlatformGuard platform="electron" fallback={<div data-testid="fallback">Not Electron</div>}>
          <div data-testid="electron-content">Electron Only</div>
        </PlatformGuard>,
      );
      expect(screen.queryByTestId('electron-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.getByText('Not Electron')).toBeInTheDocument();
    });

    it('should render nothing when platform does not match and fallback is not provided', () => {
      mockedDetectPlatform.mockReturnValue('web');
      const { container } = render(
        <PlatformGuard platform="electron">
          <div data-testid="electron-content">Electron Only</div>
        </PlatformGuard>,
      );
      expect(screen.queryByTestId('electron-content')).not.toBeInTheDocument();
      // Container should have an empty fragment
      expect(container.innerHTML).toBe('');
    });

    it('should not render fallback when platform matches', () => {
      mockedDetectPlatform.mockReturnValue('electron');
      render(
        <PlatformGuard platform="electron" fallback={<div data-testid="fallback">Fallback</div>}>
          <div data-testid="electron-content">Electron Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('electron-content')).toBeInTheDocument();
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    });

    it('should render complex fallback JSX', () => {
      mockedDetectPlatform.mockReturnValue('web');
      render(
        <PlatformGuard
          platform="electron"
          fallback={
            <div>
              <span data-testid="fallback-text">请使用桌面版</span>
            </div>
          }
        >
          <div data-testid="electron-content">Electron Only</div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('fallback-text')).toBeInTheDocument();
      expect(screen.getByText('请使用桌面版')).toBeInTheDocument();
    });
  });

  describe('嵌套使用', () => {
    it('should support nested PlatformGuard components', () => {
      mockedDetectPlatform.mockReturnValue('electron');
      render(
        <PlatformGuard platform="electron">
          <div data-testid="outer">
            <PlatformGuard platform={['android', 'ios']} fallback={<span data-testid="inner-fallback">Not Mobile</span>}>
              <div data-testid="inner-mobile">Mobile</div>
            </PlatformGuard>
          </div>
        </PlatformGuard>,
      );
      expect(screen.getByTestId('outer')).toBeInTheDocument();
      expect(screen.queryByTestId('inner-mobile')).not.toBeInTheDocument();
      expect(screen.getByTestId('inner-fallback')).toBeInTheDocument();
    });
  });
});
