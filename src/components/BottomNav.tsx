"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  Today: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  Progress: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  Food: <path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-2 2-2 6 0 8v10" />,
  History: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  Exercises: <path d="M3 9v6M6.5 6v12M17.5 6v12M21 9v6M6.5 12h11" />,
  Stretch: (
    <>
      <circle cx="15" cy="4.5" r="2" />
      <path d="M14 7.5l-3 5.5 4 3v5M11 13l-5 2-1.5 5M14 9l5 2" />
    </>
  ),
};

const TABS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/workout") },
  { href: "/progress", label: "Progress", match: (p: string) => p.startsWith("/progress") },
  { href: "/food", label: "Food", match: (p: string) => p.startsWith("/food") },
  { href: "/history", label: "History", match: (p: string) => p.startsWith("/history") },
  { href: "/exercises", label: "Exercises", match: (p: string) => p.startsWith("/exercises") },
  { href: "/flexibility", label: "Stretch", match: (p: string) => p.startsWith("/flexibility") },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const on = t.match(path);
          return (
            <Link key={t.href} href={t.href} className={`flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold ${on ? "text-accent" : "text-muted"}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {ICONS[t.label]}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
