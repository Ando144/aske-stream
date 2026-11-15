/** Tiny typed wrapper around localStorage for small, synchronous preferences. */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`aske:${key}`);
    return raw === null ? fallback : { ...fallbackObject(fallback), ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function fallbackObject<T>(fallback: T) {
  return typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)
    ? fallback
    : {};
}

export function loadValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`aske:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`aske:${key}`, JSON.stringify(value));
  } catch {
    // storage full or disabled: preferences are best effort
  }
}
