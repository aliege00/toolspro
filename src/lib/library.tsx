import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { detectKind, newId } from "./files";
import type { Kind } from "./files";

export type Entry = {
  id: string;
  key: string;
  file: File;
  url: string;
  kind: Kind;
  name: string;
  size: number;
  folder: string;
  addedAt: number;
};

export type Album = {
  id: string;
  name: string;
  keys: string[];
  createdAt: number;
};

export type TrashRecord = {
  key: string;
  name: string;
  size: number;
  kind: Kind;
  folder: string;
  deletedAt: number;
};

export const TRASH_DAYS = 30;

export function keyOf(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function folderOf(file: File): string {
  const rel = file.webkitRelativePath;
  if (!rel || !rel.includes("/")) return "";
  const parts = rel.split("/");
  parts.pop();
  return parts.join("/");
}

function loadJSON<T>(storageKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(storageKey: string, value: unknown) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* kota dolu olabilir */
  }
}

type LibraryCtx = {
  entries: Entry[];
  trashed: Entry[];
  trashRecords: TrashRecord[];
  byId: (id: string) => Entry | undefined;
  addFiles: (files: File[]) => Entry[];
  remove: (id: string) => void;
  trash: (id: string) => boolean;
  restore: (key: string) => boolean;
  purgeTrash: () => void;
  purgeExpired: () => void;

  favorites: string[];
  toggleFavorite: (key: string) => void;

  hidden: string[];
  toggleHidden: (key: string) => void;

  albums: Album[];
  createAlbum: (name: string, keys: string[]) => void;
  addToAlbum: (albumId: string, keys: string[]) => void;
  deleteAlbum: (albumId: string) => void;
};

const Ctx = createContext<LibraryCtx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [trashed, setTrashed] = useState<Entry[]>([]);
  const [trashRecords, setTrashRecords] = useState<TrashRecord[]>(() =>
    loadJSON<TrashRecord[]>("medya.trash", []),
  );
  const [favorites, setFavorites] = useState<string[]>(() =>
    loadJSON<string[]>("medya.favorites", []),
  );
  const [hidden, setHidden] = useState<string[]>(() =>
    loadJSON<string[]>("medya.hidden", []),
  );
  const [albums, setAlbums] = useState<Album[]>(() =>
    loadJSON<Album[]>("medya.albums", []),
  );

  const seen = useRef(new Set<string>());

  useEffect(() => saveJSON("medya.trash", trashRecords), [trashRecords]);
  useEffect(() => saveJSON("medya.favorites", favorites), [favorites]);
  useEffect(() => saveJSON("medya.hidden", hidden), [hidden]);
  useEffect(() => saveJSON("medya.albums", albums), [albums]);

  const purgeExpired = useCallback(() => {
    const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000;
    setTrashRecords((records) => {
      const kept = records.filter((r) => r.deletedAt >= cutoff);
      const expiredKeys = new Set(
        records.filter((r) => r.deletedAt < cutoff).map((r) => r.key),
      );
      if (expiredKeys.size > 0) {
        setTrashed((current) => {
          for (const entry of current) {
            if (expiredKeys.has(entry.key)) {
              URL.revokeObjectURL(entry.url);
              seen.current.delete(entry.key);
            }
          }
          return current.filter((e) => !expiredKeys.has(e.key));
        });
      }
      return kept;
    });
  }, []);

  useEffect(() => {
    purgeExpired();
  }, [purgeExpired]);

  const addFiles = useCallback((files: File[]) => {
    const fresh: Entry[] = [];
    for (const file of files) {
      const key = keyOf(file);
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      fresh.push({
        id: newId(),
        key,
        file,
        url: URL.createObjectURL(file),
        kind: detectKind(file),
        name: file.name,
        size: file.size,
        folder: folderOf(file),
        addedAt: Date.now(),
      });
    }
    if (fresh.length > 0) {
      setEntries((prev) => [...fresh, ...prev]);
      // çöp kutusundaki kayıt varsa kaldır (geri geldi)
      setTrashRecords((records) =>
        records.filter((r) => !fresh.some((f) => f.key === r.key)),
      );
      setTrashed((records) =>
        records.filter((r) => !fresh.some((f) => f.key === r.key)),
      );
    }
    return fresh;
  }, []);

  const byId = useCallback(
    (id: string) => entries.find((e) => e.id === id),
    [entries],
  );

  const remove = useCallback((id: string) => {
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        seen.current.delete(target.key);
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const trash = useCallback(
    (id: string) => {
      let moved: Entry | undefined;
      setEntries((prev) => {
        moved = prev.find((e) => e.id === id);
        return prev.filter((e) => e.id !== id);
      });
      if (!moved) return false;
      setTrashed((prev) => [moved!, ...prev]);
      setTrashRecords((prev) => [
        {
          key: moved!.key,
          name: moved!.name,
          size: moved!.size,
          kind: moved!.kind,
          folder: moved!.folder,
          deletedAt: Date.now(),
        },
        ...prev.filter((r) => r.key !== moved!.key),
      ]);
      return true;
    },
    [],
  );

  const restore = useCallback((key: string) => {
    let restored: Entry | undefined;
    setTrashed((prev) => {
      restored = prev.find((e) => e.key === key);
      return prev.filter((e) => e.key !== key);
    });
    if (restored) {
      setEntries((prev) => [restored!, ...prev]);
      setTrashRecords((records) => records.filter((r) => r.key !== key));
      return true;
    }
    return false;
  }, []);

  const purgeTrash = useCallback(() => {
    setTrashed((prev) => {
      for (const entry of prev) {
        URL.revokeObjectURL(entry.url);
        seen.current.delete(entry.key);
      }
      return [];
    });
    setTrashRecords([]);
  }, []);

  const toggleFavorite = useCallback((key: string) => {
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [key, ...prev],
    );
  }, []);

  const toggleHidden = useCallback((key: string) => {
    setHidden((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [key, ...prev],
    );
  }, []);

  const createAlbum = useCallback((name: string, keys: string[]) => {
    setAlbums((prev) => [
      { id: newId(), name, keys: Array.from(new Set(keys)), createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const addToAlbum = useCallback((albumId: string, keys: string[]) => {
    setAlbums((prev) =>
      prev.map((album) =>
        album.id === albumId
          ? { ...album, keys: Array.from(new Set([...album.keys, ...keys])) }
          : album,
      ),
    );
  }, []);

  const deleteAlbum = useCallback((albumId: string) => {
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
  }, []);

  const value = useMemo(
    () => ({
      entries,
      trashed,
      trashRecords,
      byId,
      addFiles,
      remove,
      trash,
      restore,
      purgeTrash,
      purgeExpired,
      favorites,
      toggleFavorite,
      hidden,
      toggleHidden,
      albums,
      createAlbum,
      addToAlbum,
      deleteAlbum,
    }),
    [
      entries,
      trashed,
      trashRecords,
      byId,
      addFiles,
      remove,
      trash,
      restore,
      purgeTrash,
      purgeExpired,
      favorites,
      toggleFavorite,
      hidden,
      toggleHidden,
      albums,
      createAlbum,
      addToAlbum,
      deleteAlbum,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
