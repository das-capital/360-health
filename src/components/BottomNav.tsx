"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MORE_PATHS = ["/more", "/steps", "/sleep", "/mobility", "/vitals", "/settings"];

const TABS = [
  { href: "/", label: "Today", icon: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" },
  { href: "/food", label: "Food", icon: "M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 2-3 4-3 7h3v11" },
  { href: "/exercises", label: "Exercises", icon: "M3 12h18M6 7v10M18 7v10M3 9.5v5M21 9.5v5" },
  { href: "/history", label: "History", icon: "M4 20V10M10 20V4M16 20v-7M21 20H3" },
  { href: "/more", label: "More", icon: "M5 12h.01M12 12h.01M19 12h.01" },
] as const;

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/more") return MORE_PATHS.some((p) => pathname.startsWith(p));
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-800 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = isActive(tab.href, pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${
                  active ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={tab.href === "/more" ? 3 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
