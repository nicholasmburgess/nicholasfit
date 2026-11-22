import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { DemoBanner } from "@/components/DemoBanner";
import { NativeBridge } from "@/components/NativeBridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nicholasfit",
  description: "Personal training, body and nutrition tracker",
  appleWebApp: { capable: true, title: "Nicholasfit", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ecdc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1d15" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body className="antialiased">
        <div className="mx-auto min-h-dvh max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
          <DemoBanner />
          {children}
        </div>
        <BottomNav />
        <NativeBridge />
      </body>
    </html>
  );
}
