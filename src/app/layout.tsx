import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Image Generator • DevChallenges",
  description: "Full‑stack AI Image Generator (Next.js + Supabase) — challenge solution.",
  icons: {
    icon: "/favicons/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b1220] text-white min-h-screen`}
      >
        {process.env.NODE_ENV === 'development' && (
          <style
            dangerouslySetInnerHTML={{
              __html: `
                [data-nextjs-toast],
                [data-nextjs-dialog-overlay],
                [data-nextjs-dev-overlay],
                #__next-build-watcher,
                #nextjs__container,
                [id^="nextjs-dev-overlay"],
                [data-nextjs-hmr-overlay] {
                  display: none !important;
                }
              `,
            }}
          />
        )}
        {children}
      </body>
    </html>
  );
}
