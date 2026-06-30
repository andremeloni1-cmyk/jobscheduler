"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Render into document.body so the dialog escapes the page's stacking context
  // (the `fade-in` transform on <main> would otherwise trap it below the nav).
  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState(false); // present in the DOM
  const [shown, setShown] = useState(false); // animated into view
  const [drag, setDrag] = useState(0); // px dragged down (sheet dismiss)
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  // Mount → next frame slide up; close → slide down, then unmount after the transition.
  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = setTimeout(() => {
      setRender(false);
      setDrag(0);
    }, 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !render) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    setDrag(dy > 0 ? dy : 0); // only drag downward
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    if (drag > 120) onClose(); // past threshold → dismiss
    else setDrag(0); // snap back
    startY.current = null;
  };

  const sheetStyle: React.CSSProperties = {
    transform: shown ? `translateY(${drag}px)` : "translateY(100%)",
    transition: isDragging ? "none" : "transform 0.34s cubic-bezier(0.22,1,0.36,1)",
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <div
        className={`absolute inset-0 bg-slate-900/55 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white dark:bg-night-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl dark:shadow-none sm:max-h-[85vh] sm:rounded-3xl"
        style={sheetStyle}
      >
        {/* Drag handle (mobile bottom-sheet) — drag down to dismiss. */}
        <div
          className="-mt-1 mb-3 flex cursor-grab justify-center sm:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-night-line" />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-night-800" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
