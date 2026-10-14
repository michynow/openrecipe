import type { Metadata } from "next";
import { Baloo_2, JetBrains_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { copy } from "@openrecipe/core/copy";

/**
 * Root layout: document, fonts, nothing else.
 *
 * The app shell lives in (app)/layout.tsx rather than here, because a nested
 * layout composes with its parent — it cannot remove a header the root rendered.
 * /login and /join must not show navigation to an app you are not signed into.
 *
 * latin-ext on all three fonts is not optional: Polish needs ą ć ę ł ń ó ś ź ż,
 * and a display face that silently falls back mid-word would wreck every heading.
 */
const display = Baloo_2({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: "800",
  display: "swap",
});

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/** Quantities and units, so numbers align down the ingredients column. */
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: copy.app.name,
  // Private instance — keep it out of search results entirely.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
