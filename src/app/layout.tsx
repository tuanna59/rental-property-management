import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Sans_3 } from "next/font/google";

import { AppShell } from "@/components/app-shell/app-shell";
import { getPrimaryPropertyShell } from "@/modules/property/server/property.queries";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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
  let property = null;

  try {
    property = await getPrimaryPropertyShell();
  } catch (error) {
    console.error("Unable to load the shared application shell.", error);
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${sourceSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: sidebarPreferenceScript }}
        />
        {property ? (
          <AppShell property={property}>{children}</AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
