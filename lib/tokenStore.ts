/**
 * The GitHub token lives in localStorage, which is external state. Exposing it
 * through a tiny store keeps `useSyncExternalStore` happy: no setState-in-effect,
 * no hydration mismatch, and it stays in step across tabs.
 */
const KEY = "goodfirstrepos:token";

let cached: string | null = null;
const listeners = new Set<() => void>();

function read(): string {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(KEY) ?? "";
  } catch {
    cached = ""; // Private mode, or storage blocked.
  }
  return cached;
}

export function subscribeToken(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cached = event.newValue ?? "";
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getToken(): string {
  return read();
}

/** The server never has the viewer's token, so it renders the empty state. */
export function getServerToken(): string {
  return "";
}

export function setStoredToken(next: string): void {
  cached = next;
  try {
    if (next) window.localStorage.setItem(KEY, next);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Keep it in memory for this session only.
  }
  listeners.forEach((listener) => listener());
}
