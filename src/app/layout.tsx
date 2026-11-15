import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { DemoBanner } from "@/components/DemoBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nicholasfit",
  description: "Personal training, body and nutrition tracker",
  appleWebApp: { capable: true, title: "Nicholasfit", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
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
      </body>
    </html>
  );
}
