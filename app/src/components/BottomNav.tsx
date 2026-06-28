"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Jobs", icon: ClipboardIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/reports", label: "Reports", icon: ReportIcon },
  { href: "/settings", label: "Settings", icon: CogIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                active ? "text-brand-600" : "text-stone-400"
              }`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9z" />
      <path d="M9 11h6M9 15h4" strokeLinecap="round" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20c0-2.3-1-4-2.5-5" strokeLinecap="round" />
    </svg>
  );
}
function ReportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  );
}
function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" strokeLinecap="round" />
    </svg>
  );
}
