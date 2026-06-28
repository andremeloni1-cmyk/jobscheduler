"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/job";

type Branding = { name: string | null; logo: string | null; logoMime: string | null };

/** Shows the owner's business name + logo (falls back to the app name / saw mark
 * until branding loads or if none is set). */
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
  const logoSrc = b?.logo ? `data:${b.logoMime || "image/png"};base64,${b.logo}` : null;

  if (variant === "hero") {
    return (
      <div className="flex flex-col items-center text-center">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt={name} className="mb-4 max-h-20 max-w-[220px] object-contain" />
        ) : (
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-lg">
            <SawIcon className="h-8 w-8" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-stone-900">{name}</h1>
        {tagline && <p className="mb-6 text-sm text-stone-500">{tagline}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      {logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="h-9 max-w-[110px] object-contain" />
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{name}</h1>
        {tagline && <p className="text-sm text-stone-500">{tagline}</p>}
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
