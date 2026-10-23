import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { detectKind, newId } from "./files";
import type { Kind } from "./files";

export type Entry = {
  id: string;
  file: File;
  url: string;
  kind: Kind;
  name: string;
  size: number;
  addedAt: number;
};

type LibraryCtx = {
  entries: Entry[];
  byId: (id: string) => Entry | undefined;
  addFiles: (files: File[]) => Entry[];
  remove: (id: string) => void;
  clear: () => void;
};

const Ctx = createContext<LibraryCtx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const seen = useRef(new Set<string>());

  const addFiles = useCallback((files: File[]) => {
    const fresh: Entry[] = [];
    for (const file of files) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      fresh.push({
        id: newId(),
        file,
        url: URL.createObjectURL(file),
        kind: detectKind(file),
        name: file.name,
        size: file.size,
        addedAt: Date.now(),
      });
    }
    if (fresh.length > 0) setEntries((prev) => [...fresh, ...prev]);
    return fresh;
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        seen.current.delete(`${target.file.name}:${target.file.size}:${target.file.lastModified}`);
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setEntries((prev) => {
      for (const e of prev) URL.revokeObjectURL(e.url);
      seen.current.clear();
      return [];
    });
  }, []);

  const byId = useCallback(
    (id: string) => entries.find((e) => e.id === id),
    [entries],
  );

  const value = useMemo(
    () => ({ entries, byId, addFiles, remove, clear }),
    [entries, byId, addFiles, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
