const KEY = "medya.pin";

type StoredPin = { salt: string; hash: string };

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function read(): StoredPin | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPin;
    if (typeof parsed.salt === "string" && typeof parsed.hash === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasPin(): boolean {
  return read() !== null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(KEY, JSON.stringify({ salt, hash }));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = read();
  if (!stored) return true;
  const hash = await hashPin(pin, stored.salt);
  return hash === stored.hash;
}

export function clearPin(): void {
  localStorage.removeItem(KEY);
}
