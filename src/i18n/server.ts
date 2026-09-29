import { cookies } from "next/headers";
import { createTranslator } from "next-intl";

import { LOCALE_COOKIE, resolveLocale, type AppLocale } from "./config";
import { getMessages, type AppMessages } from "./messages";

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

export async function getServerTranslator<Namespace extends keyof AppMessages>(
  namespace: Namespace,
) {
  const locale = await getRequestLocale();
  return createTranslator({
    locale,
    messages: getMessages(locale),
    namespace,
  });
}
