import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist_Mono, Source_Sans_3 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";

import { AppShell } from "@/components/app-shell/app-shell";
import { getMessages } from "@/i18n/messages";
import { getRequestLocale } from "@/i18n/server";
import { getPrimaryPropertyShell } from "@/modules/property/server/property.queries";
import { ThemeProvider } from "@/theme/theme-provider";
import { themeBootstrapScript } from "@/theme/theme-script";

import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin", "vietnamese"],
  variable: "--font-source-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rental House",
  description: "Rental property building management foundation",
};

const sidebarPreferenceScript = `
try {
  if (localStorage.getItem("rental-house:sidebar-collapsed") === "true") {
    document.documentElement.dataset.sidebarCollapsed = "true";
  }
} catch {}
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);
  let property = null;

  try {
    property = await getPrimaryPropertyShell();
  } catch (error) {
    console.error("Unable to load the shared application shell.", error);
  }

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${sourceSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: sidebarPreferenceScript }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            {property ? (
              <AppShell property={property}>{children}</AppShell>
            ) : (
              children
            )}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
