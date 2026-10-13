import { getMessages, isSupportedLocale, negotiateLocale } from '@vogn/i18n';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const LOCALE_COOKIE = 'vogn_locale';

/**
 * Locale resolution without URL prefixes: explicit user choice (cookie, kept in sync with the profile
 * setting) → Accept-Language → English.
 */
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : negotiateLocale((await headers()).get('accept-language'));
  return {
    locale,
    messages: getMessages(locale),
    timeZone: 'UTC',
    onError(error) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join('.');
    },
  };
});
