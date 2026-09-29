import type { AppLocale } from "./config";
import type { AppMessages } from "./messages";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: AppMessages;
  }
}
