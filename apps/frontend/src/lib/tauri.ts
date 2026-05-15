/** True when running inside the Tauri WebView (desktop), false in Vite-only browser dev. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
