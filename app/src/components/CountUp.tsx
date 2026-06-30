"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number up to `to` on mount / when `to` changes (easeOutCubic).
 * Snaps instantly when the user prefers reduced motion. `format` receives the
 * current animated value so callers can render currency, etc. */
export function CountUp({
  to,
  durationMs = 700,
  format,
  className,
}: {
  to: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(to);
      fromRef.current = to;
      return;
    }
    const start = fromRef.current;
    let raf = 0;
    let t0: number | null = null;
    const tick = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(start + (to - start) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVal(to);
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);

  return <span className={className}>{format ? format(val) : String(Math.round(val))}</span>;
}
