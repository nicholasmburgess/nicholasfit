"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/workout") },
  { href: "/history", label: "History", match: (p: string) => p.startsWith("/history") },
  { href: "/exercises", label: "Exercises", match: (p: string) => p.startsWith("/exercises") },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 py-3 text-center text-sm font-medium ${t.match(path) ? "text-accent" : "text-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
