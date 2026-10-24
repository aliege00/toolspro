const KEY = "medya.rename";

export function getAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function aliasFor(key: string): string | undefined {
  return getAliases()[key];
}

export function displayName(key: string, fallback: string): string {
  return getAliases()[key] ?? fallback;
}

export function applyAliases(map: Record<string, string>): void {
  const next = { ...getAliases(), ...map };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearAliases(): void {
  localStorage.removeItem(KEY);
}
