// Light/dark theme handling. Choice is stored in localStorage; "system" (the
// default) follows the device's prefers-color-scheme. The actual class toggle
// is applied to <html> — both by an inline no-flash script in the layout (for
// first paint) and by setTheme()/the watcher at runtime.

export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "jf-theme";

export function getStoredTheme(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(choice: ThemeChoice): void {
  if (choice === "system") localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, choice);
  applyTheme(choice);
}

// Inline <script> string run before paint to avoid a light flash on dark load.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
