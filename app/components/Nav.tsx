"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();

  return (
    <header className="border-b border-neutral-200 px-8 py-5 flex items-center justify-between">
      <span className="text-sm font-medium tracking-widest uppercase">Design Scrape</span>
      <div className="flex gap-1 text-sm">
        {[
          { label: "Queue", href: "/" },
          { label: "Analytics", href: "/analytics" },
        ].map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-1.5 rounded-full transition-colors ${
              path === href ? "bg-black text-white" : "text-neutral-400 hover:text-black"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </header>
  );
}
