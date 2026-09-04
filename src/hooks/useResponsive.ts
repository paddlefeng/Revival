/**
 * 响应式布局 Hook
 * 提供断点检测、触摸检测和平台感知能力
 */

import { useState, useEffect } from 'react';
import { detectPlatform, isTouchDevice } from '../platform';
import type { RevivalPlatform } from '../platform';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveInfo {
  breakpoint: Breakpoint;
  platform: RevivalPlatform;
  isTouch: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

function getBreakpoint(width: number): Breakpoint {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function useResponsive(): ResponsiveInfo {
  const [info, setInfo] = useState<ResponsiveInfo>(() => {
    const w = window.innerWidth;
    return {
      breakpoint: getBreakpoint(w),
      platform: detectPlatform(),
      isTouch: isTouchDevice(),
      isMobile: getBreakpoint(w) === 'mobile',
      isTablet: getBreakpoint(w) === 'tablet',
      isDesktop: getBreakpoint(w) === 'desktop',
      width: w,
      height: window.innerHeight,
      orientation: w > window.innerHeight ? 'landscape' : 'portrait',
    };
  });

  useEffect(() => {
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setInfo({
          breakpoint: getBreakpoint(w),
          platform: detectPlatform(),
          isTouch: isTouchDevice(),
          isMobile: getBreakpoint(w) === 'mobile',
          isTablet: getBreakpoint(w) === 'tablet',
          isDesktop: getBreakpoint(w) === 'desktop',
          width: w,
          height: h,
          orientation: w > h ? 'landscape' : 'portrait',
        });
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return info;
}
