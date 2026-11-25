import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { DemoBanner } from "@/components/DemoBanner";
import { NativeBridge } from "@/components/NativeBridge";
import { WithingsAutoSync } from "@/components/WithingsAutoSync";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Nicholasfit",
  description: "Personal training, body and nutrition tracker",
  appleWebApp: { capable: true, title: "Nicholasfit", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={inter.variable}>
      <body className="antialiased">
        <div className="mx-auto min-h-dvh max-w-md px-4 md:max-w-3xl md:px-8 lg:max-w-5xl pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          <DemoBanner />
          <ExpiryBanner />
          {children}
        </div>
        <BottomNav />
        <NativeBridge />
        <WithingsAutoSync />
      </body>
    </html>
  );
}
