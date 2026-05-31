"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Compare" },
  { href: "/settings", label: "Settings" },
];

export function TopBar({ email }: { email: string }) {
  const pathname = usePathname();
  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-lime/40 bg-lime/10 text-lime">
              <span className="text-sm leading-none">▦</span>
            </span>
            <span className="font-display text-xs font-bold tracking-[0.28em] text-text">
              PIXELDRIFT
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition ${
                    active
                      ? "bg-panel-2 text-lime"
                      : "text-text-dim hover:bg-panel-2 hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 md:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-panel-2 font-mono text-xs text-text-dim">
              {initial}
            </span>
            <span className="max-w-[14rem] truncate font-mono text-xs text-text-dim">
              {email}
            </span>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] text-text-dim transition hover:border-line-bright hover:text-text"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
