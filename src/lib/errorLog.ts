export type LoggedError = {
  id: string;
  at: number;
  source: string;
  message: string;
  stack?: string;
};

const STORAGE_KEY = "beytool.errorLog";
const MAX_ENTRIES = 40;

function read(): LoggedError[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is LoggedError =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as LoggedError).message === "string" &&
        typeof (entry as LoggedError).at === "number",
    );
  } catch {
    return [];
  }
}

let entries: LoggedError[] = read();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Depolama dolu olabilir; günlük yine bu oturumda görünür.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function logError(source: string, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
  const stack = error instanceof Error ? error.stack : undefined;
  const entry: LoggedError = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    source,
    message: message || "Bilinmeyen hata",
    stack: stack ? stack.split("\n").slice(0, 8).join("\n") : undefined,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persist();
  emit();
}

export function getErrorLog(): LoggedError[] {
  return entries;
}

export function hasErrorLog(): boolean {
  return entries.length > 0;
}

export function subscribeErrorLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearErrorLog() {
  entries = [];
  persist();
  emit();
}

export function formatErrorLog(): string {
  if (entries.length === 0) return "BeyTool hata günlüğü boş.";
  return entries
    .map((entry) => {
      const time = new Date(entry.at).toISOString();
      const head = `[${time}] ${entry.source}: ${entry.message}`;
      return entry.stack ? `${head}\n${entry.stack}` : head;
    })
    .join("\n\n");
}

/** Yakalanmamış hata ve promise redlerini günlüğe yazar. */
export function installGlobalErrorLogging(): () => void {
  const onError = (event: ErrorEvent) => {
    logError("window", event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    logError("promise", event.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
