// Quote / purchase-order reference helpers. Job titles and PDF filenames carry
// a quote number like "QU3279" (or a PO like "PO5332"); we use it to tie a
// document to the right job instead of matching loosely on the sender.

/** Extracts a normalised quote/PO token (e.g. "QU3279", "PO5332") or null. */
export function quoteRef(s?: string | null): string | null {
  if (!s) return null;
  const m = s.toUpperCase().match(/\b(QU|PO)\s?-?\d{3,}\b/);
  return m ? m[0].replace(/[\s-]/g, "") : null;
}

/** True if a filename appears to belong to the given quote/PO reference. */
export function fileMatchesRef(filename: string, ref: string | null): boolean {
  if (!ref) return false;
  return filename.toUpperCase().replace(/[\s-]/g, "").includes(ref);
}
