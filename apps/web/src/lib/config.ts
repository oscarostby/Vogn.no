/** Client-safe configuration flags (NEXT_PUBLIC_* only). */
export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  clerkConfigured: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
  privateTestAuth: process.env.NEXT_PUBLIC_TEST_AUTH_ENABLED === 'true',
  cloudinaryCloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? null,
} as const;

export const THEME_COOKIE = 'vogn_theme';
export const MOTION_COOKIE = 'vogn_motion';
export const LOCALE_COOKIE = 'vogn_locale';
