"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
};

const tabs: Tab[] = [
  { href: "/home", label: "Home", icon: (a) => <span>🏠</span> },
  { href: "/markets", label: "Markets", icon: (a) => <span>📊</span> },
  { href: "/trade", label: "Trade", icon: (a) => <span>⚡</span> },
  { href: "/wallet", label: "Wallet", icon: (a) => <span>💼</span> },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-t border-white/10">
      <ul className="flex justify-around items-center h-16">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-1 text-xs transition-all
                  ${active ? "text-blue-400 scale-110" : "text-white/60"}`}
              >
                {t.icon(active)}
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}