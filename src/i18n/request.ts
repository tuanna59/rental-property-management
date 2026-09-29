import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE, resolveLocale } from "./config";
import { getMessages } from "./messages";

/**
 * next-intl App Router request configuration.
 *
 * Locale is intentionally preference/cookie based rather than route based,
 * so application URLs stay clean (/dashboard, /building, ...).
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: getMessages(locale),
  };
});
