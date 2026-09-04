/**
 * PlatformGuard - 平台守卫组件
 * 根据当前运行平台决定渲染内容，支持单一平台或平台列表匹配
 */

import { type ReactNode } from 'react';
import { detectPlatform } from '../platform';
import type { RevivalPlatform } from '../platform';

export interface PlatformGuardProps {
  /** 允许渲染的平台（单个或多个） */
  platform: RevivalPlatform | RevivalPlatform[];
  /** 不匹配时的 fallback 内容（可选） */
  fallback?: ReactNode;
  /** 匹配时渲染的内容 */
  children: ReactNode;
}

/**
 * 平台守卫组件
 *
 * 使用方式：
 * ```tsx
 * <PlatformGuard platform="electron">
 *   <ElectronOnlyFeature />
 * </PlatformGuard>
 *
 * <PlatformGuard platform={['android', 'ios']} fallback={<div>仅移动端</div>}>
 *   <MobileFeature />
 * </PlatformGuard>
 * ```
 */
export function PlatformGuard({ platform, fallback = null, children }: PlatformGuardProps): ReactNode {
  const currentPlatform = detectPlatform();

  const platforms: RevivalPlatform[] = Array.isArray(platform) ? platform : [platform];

  if (platforms.includes(currentPlatform)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
