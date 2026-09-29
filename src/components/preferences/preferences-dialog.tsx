"use client";

import * as React from "react";
import { Check, Languages, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { persistLocale } from "@/i18n/client";
import { isAppLocale, type AppLocale } from "@/i18n/config";
import { useTheme } from "@/theme/theme-provider";
import type { ThemePreference } from "@/theme/theme";

import "./preferences.css";

const themeOptions: Array<{
  value: ThemePreference;
  labelKey: "light" | "dark" | "system";
  icon: typeof Sun;
}> = [
  { value: "light", labelKey: "light", icon: Sun },
  { value: "dark", labelKey: "dark", icon: Moon },
  { value: "system", labelKey: "system", icon: Monitor },
];

const localeOptions: Array<{
  value: AppLocale;
  labelKey: "english" | "vietnamese";
}> = [
  { value: "en", labelKey: "english" },
  { value: "vi", labelKey: "vietnamese" },
];

export function PreferencesDialog({ trigger }: { trigger: React.ReactNode }) {
  const t = useTranslations("preferences");
  const locale = useLocale();
  const router = useRouter();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [isPending, startTransition] = React.useTransition();

  const activeLocale: AppLocale = isAppLocale(locale) ? locale : "en";

  const changeLocale = React.useCallback(
    (next: AppLocale) => {
      if (next === activeLocale) return;
      persistLocale(next);
      startTransition(() => router.refresh());
    },
    [activeLocale, router],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="preferences-dialog">
        <DialogHeader>
          <div className="preferences-title-row">
            <span className="preferences-title-icon"><Palette aria-hidden="true" /></span>
            <div>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <section className="preferences-section" aria-labelledby="preferences-theme-label">
          <div className="preferences-section-heading">
            <span id="preferences-theme-label">{t("theme")}</span>
            <small>{preference === "system" ? `${t("system")} · ${resolvedTheme === "dark" ? t("dark") : t("light")}` : null}</small>
          </div>
          <div className="preferences-segmented" role="radiogroup" aria-label={t("theme")}>
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const selected = preference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "is-selected" : undefined}
                  onClick={() => setPreference(option.value)}
                >
                  <Icon aria-hidden="true" />
                  <span>{t(option.labelKey)}</span>
                  {selected ? <Check aria-hidden="true" className="preferences-check" /> : null}
                </button>
              );
            })}
          </div>
          <p className="preferences-hint">{t("systemHint")}</p>
        </section>

        <section className="preferences-section" aria-labelledby="preferences-language-label">
          <div className="preferences-section-heading">
            <span id="preferences-language-label">{t("language")}</span>
            <Languages aria-hidden="true" />
          </div>
          <div className="preferences-language-options" role="radiogroup" aria-label={t("language")}>
            {localeOptions.map((option) => {
              const selected = activeLocale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "is-selected" : undefined}
                  disabled={isPending}
                  onClick={() => changeLocale(option.value)}
                >
                  <span>{t(option.labelKey)}</span>
                  <small>{option.value === "en" ? "EN" : "VI"}</small>
                  {selected ? <Check aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
