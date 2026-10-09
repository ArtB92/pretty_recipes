import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (src/fonts) so builds never depend on reaching Google Fonts.
const bricolage = localFont({ src: "../fonts/bricolage-latin.woff2", weight: "500 700", variable: "--font-bricolage" });
const atkinson = localFont({ src: "../fonts/atkinson-latin.woff2", weight: "400 600", variable: "--font-atkinson" });

export const metadata: Metadata = {
  title: "Pretty Recipes",
  description: "Turn a recipe from text, a photo, or a TikTok or Instagram link into a clean page to print or share.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fa" },
    { media: "(prefers-color-scheme: dark)", color: "#15191b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${atkinson.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
