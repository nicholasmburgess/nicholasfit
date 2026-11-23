"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  Today: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  Progress: (
    <>
      <rect x="4" y="13" width="4" height="7" rx="1.5" />
      <rect x="10" y="9" width="4" height="11" rx="1.5" />
      <rect x="16" y="4" width="4" height="16" rx="1.5" />
    </>
  ),
  Food: <path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-2 2-2 6 0 8v10" />,
  Workout: <path d="M3 9v6M6.5 6v12M17.5 6v12M21 9v6M6.5 12h11" />,
  Row: (
    <path d="M3 7c1.5 0 2-1.5 3.5-1.5S8.5 7 10 7s2-1.5 3.5-1.5S15.5 7 17 7s2-1.5 3.5-1.5M3 12.5c1.5 0 2-1.5 3.5-1.5s2 1.5 3.5 1.5 2-1.5 3.5-1.5 2 1.5 3.5 1.5 2-1.5 3.5-1.5M3 18c1.5 0 2-1.5 3.5-1.5S8.5 18 10 18s2-1.5 3.5-1.5S15.5 18 17 18s2-1.5 3.5-1.5" />
  ),
  Stretch: <path d="M12 4.5c2 2.5 2 7.5 0 10.5-2-3-2-8 0-10.5zM12 15c-3.5 0-6.5-2.5-7.5-6.5 3.5.3 6.5 2.5 7.5 6.5zM12 15c3.5 0 6.5-2.5 7.5-6.5-3.5.3-6.5 2.5-7.5 6.5zM5 19h14" />,
};

const TABS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" },
  { href: "/workouts", label: "Workout", match: (p: string) => p.startsWith("/workout") },
  { href: "/flexibility", label: "Stretch", match: (p: string) => p.startsWith("/flexibility") },
  { href: "/row", label: "Row", match: (p: string) => p.startsWith("/row") },
  { href: "/food", label: "Food", match: (p: string) => p.startsWith("/food") },
  { href: "/progress", label: "Progress", match: (p: string) => p.startsWith("/progress") || p.startsWith("/exercises") },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md md:max-w-xl">
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
