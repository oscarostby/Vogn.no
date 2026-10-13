import type { PlatformRole } from '@vogn/types';

export const PLATFORM_ACTIONS = [
  'view_admin',
  'view_stats',
  'review_reports',
  'moderate_content',
  'suspend_users',
  'review_verification',
  'manage_crews',
  'view_audit_logs',
  'manage_marketplace',
  'manage_platform_roles',
] as const;
export type PlatformAction = (typeof PLATFORM_ACTIONS)[number];

/** Least-privilege matrix for VOGN staff. */
const MATRIX: Record<PlatformRole, readonly PlatformAction[]> = {
  user: [],
  support: ['view_admin', 'view_stats', 'review_reports'],
  moderator: [
    'view_admin',
    'view_stats',
    'review_reports',
    'moderate_content',
    'suspend_users',
    'review_verification',
    'manage_marketplace',
  ],
  admin: PLATFORM_ACTIONS,
};

export function platformCan(role: PlatformRole | null | undefined, action: PlatformAction): boolean {
  if (!role) return false;
  return MATRIX[role].includes(action);
}

export function platformActionsFor(role: PlatformRole): readonly PlatformAction[] {
  return MATRIX[role];
}
