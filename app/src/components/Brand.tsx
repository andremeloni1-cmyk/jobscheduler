"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/job";

type Branding = {
  name: string | null;
  logo: string | null;
  logoMime: string | null;
  logoDark: string | null;
  logoDarkMime: string | null;
};

/** Shows the owner's business name + logo (falls back to the app name / saw mark
 * until branding loads or if none is set). When a separate dark-mode logo is set
 * it's shown in dark mode; otherwise the main logo is used in both themes. */
export function Brand({
  variant = "header",
  fallback = "JoineryFlow",
  tagline,
}: {
  variant?: "header" | "hero";
  fallback?: string;
  tagline?: string;
}) {
  const [b, setB] = useState<Branding | null>(null);
  useEffect(() => {
    api<Branding>("/api/branding").then(setB).catch(() => {});
  }, []);

  const name = b?.name || fallback;
  const lightSrc = b?.logo ? `data:${b.logoMime || "image/png"};base64,${b.logo}` : null;
  // Dark-mode logo falls back to the main logo when not set.
  const darkSrc = b?.logoDark ? `data:${b.logoDarkMime || "image/png"};base64,${b.logoDark}` : lightSrc;

  const hero = variant === "hero";
  const imgCls = hero ? "max-h-20 max-w-[220px] object-contain" : "h-9 max-w-[110px] object-contain";

  // Two <img>s toggled by theme via Tailwind's dark: variant — reacts instantly
  // to theme changes with no extra JS.
  const logos = lightSrc ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lightSrc} alt={hero ? name : ""} className={`${imgCls} block dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={darkSrc || lightSrc} alt={hero ? name : ""} className={`${imgCls} hidden dark:block`} />
    </>
  ) : null;

  if (hero) {
    return (
      <div className="flex flex-col items-center text-center">
        {logos ? (
          <div className="mb-4">{logos}</div>
        ) : (
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-lg">
            <SawIcon className="h-8 w-8" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{name}</h1>
        {tagline && <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{tagline}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      {logos}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{name}</h1>
        {tagline && <p className="text-sm text-slate-500 dark:text-slate-400">{tagline}</p>}
      </div>
    </div>
  );
}

function SawIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l11 11M14 18l6-6-3-3-6 6M3 7l4-4 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
