import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { detectKind, newId } from "./files";
import type { Kind } from "./files";
import { isNative } from "./native";
import {
  deleteStored,
  extensionOf,
  loadLibraryIndex,
  persistBlob,
  readStoredBlob,
  readStoredFile,
  saveLibraryIndex,
  storedFileUri,
} from "./storage";
import type { LibraryIndex, PersistedEntry } from "./storage";

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
  /** Özel depodaki kalıcı yol; yoksa dosya yalnızca bu oturumda geçerlidir. */
  path?: string;
  persisted?: boolean;
  trashedAt?: number;
  /**
   * Kalıcı dosyanın içeriğini gerektiğinde okur. Mobilde kitaplık açılışında
   * dosyalar belleğe alınmaz; FFmpeg/hash gibi içerik isteyen işler bunu çağırır.
   */
  materialize?: () => Promise<File>;
};

/** Bir kütüphane kaydının gerçek dosyasını (gerekirse diskten okuyarak) döndürür. */
export async function entryFile(entry: Entry): Promise<File> {
  if (entry.materialize) return entry.materialize();
  return entry.file;
}

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

function toPersisted(entry: Entry): PersistedEntry | null {
  if (!entry.path) return null;
  return {
    id: entry.id,
    key: entry.key,
    name: entry.name,
    size: entry.size,
    type: entry.file.type || "application/octet-stream",
    kind: entry.kind,
    folder: entry.folder,
    addedAt: entry.addedAt,
    lastModified: entry.file.lastModified || Date.now(),
    path: entry.path,
    deletedAt: entry.trashedAt,
  };
}

function toTrashRecord(entry: Entry): TrashRecord {
  return {
    key: entry.key,
    name: entry.name,
    size: entry.size,
    kind: entry.kind,
    folder: entry.folder,
    deletedAt: entry.trashedAt ?? Date.now(),
  };
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

  hydrating: boolean;
  storageError: string | null;
  dismissStorageError: () => void;

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

/** Yalnızca blob adreslerini bırak; yerel sunucu adresleri kendiliğinden geçerlidir. */
function releaseUrl(url: string): void {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [trashed, setTrashed] = useState<Entry[]>([]);
  const [trashRecords, setTrashRecords] = useState<TrashRecord[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
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
  const objectUrls = useRef(new Set<string>());
  const hydrated = useRef(false);
  const entriesRef = useRef<Entry[]>([]);
  const trashedRef = useRef<Entry[]>([]);
  entriesRef.current = entries;
  trashedRef.current = trashed;

  useEffect(() => saveJSON("medya.favorites", favorites), [favorites]);
  useEffect(() => saveJSON("medya.hidden", hidden), [hidden]);
  useEffect(() => saveJSON("medya.albums", albums), [albums]);

  // Dosyaları özel depodan geri yükle. Gizli dosyalar da aynı yolu kullanır;
  // gizlilik yalnızca bir anahtar işaretidir, ayrı bir depolama alanı yoktur.
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];

    const loadOne = async (record: PersistedEntry): Promise<Entry | null> => {
      let file: File | null = null;
      let url = "";
      let materialize: (() => Promise<File>) | undefined;

      if (isNative()) {
        // Dosya içeriği belleğe alınmaz: video/görsel yerel sunucudan akar.
        // Böylece çok sayıda büyük video kitaplık açılışında belleği doldurmaz.
        try {
          const uri = await storedFileUri(record.path);
          url = Capacitor.convertFileSrc(uri);
          file = new File([], record.name, {
            type: record.type,
            lastModified: record.lastModified,
          });
          let cached: File | null = null;
          materialize = async () => {
            if (!cached) {
              cached = await readStoredFile(
                record.path,
                record.name,
                record.type,
                record.lastModified,
              );
            }
            return cached;
          };
        } catch {
          // Yerel adres alınamadı; aşağıda blob yolu denenir.
        }
      }

      if (!file) {
        try {
          const blob = await readStoredBlob(record.path, record.type);
          file = new File([blob], record.name, {
            type: record.type,
            lastModified: record.lastModified,
          });
          url = URL.createObjectURL(file);
          urls.push(url);
          objectUrls.current.add(url);
        } catch {
          return null;
        }
      }

      seen.current.add(record.key);
      return {
        id: record.id,
        key: record.key,
        file,
        url,
        materialize,
        kind: record.kind,
        name: record.name,
        size: record.size || file.size,
        folder: record.folder,
        addedAt: record.addedAt,
        path: record.path,
        persisted: true,
        trashedAt: record.deletedAt,
      };
    };

    void (async () => {
      const index = await loadLibraryIndex();
      const loadedEntries: Entry[] = [];
      const loadedTrash: Entry[] = [];

      for (const record of index.entries) {
        if (!alive) break;
        const entry = await loadOne(record);
        if (entry) loadedEntries.push(entry);
      }
      for (const record of index.trash) {
        if (!alive) break;
        const entry = await loadOne(record);
        if (entry) {
          loadedTrash.push(entry);
          // Çöp kutusundaki dosya yeniden seçilebilsin diye tekrar engellenmez.
          seen.current.delete(record.key);
        }
      }

      if (!alive) {
        for (const url of urls) URL.revokeObjectURL(url);
        return;
      }

      // Yükleme sırasında eklenen dosyaları ezme; anahtara göre birleştir.
      setEntries((current) => {
        const keys = new Set(current.map((entry) => entry.key));
        return [...current, ...loadedEntries.filter((entry) => !keys.has(entry.key))];
      });
      setTrashed((current) => {
        const keys = new Set(current.map((entry) => entry.key));
        return [...current, ...loadedTrash.filter((entry) => !keys.has(entry.key))];
      });
      setTrashRecords((current) => {
        const keys = new Set(current.map((record) => record.key));
        return [...current, ...index.trashRecords.filter((record) => !keys.has(record.key))];
      });

      // Diskte bulunamayan dosyaların favori, gizli ve albüm işaretlerini de
      // temizle. Aksi halde liste boşalsa bile bu anahtarlar sonsuza kadar kalır.
      const liveKeys = new Set<string>([
        ...entriesRef.current.map((entry) => entry.key),
        ...loadedEntries.map((entry) => entry.key),
        ...loadedTrash.map((entry) => entry.key),
      ]);
      setFavorites((current) => current.filter((key) => liveKeys.has(key)));
      setHidden((current) => current.filter((key) => liveKeys.has(key)));
      setAlbums((current) =>
        current
          .map((album) => ({
            ...album,
            keys: album.keys.filter((key) => liveKeys.has(key)),
          }))
          .filter((album) => album.keys.length > 0),
      );

      // Disk indeksini de yalnızca gerçekten okunabilen dosyalarla yeniden yaz;
      // böylece silinmiş dosyalar bir sonraki açılışta yeniden denenmez.
      const pruned: LibraryIndex = {
        version: 2,
        entries: loadedEntries.map(toPersisted).filter((entry): entry is PersistedEntry => !!entry),
        trash: loadedTrash.map(toPersisted).filter((entry): entry is PersistedEntry => !!entry),
        trashRecords: index.trashRecords.filter((record) => liveKeys.has(record.key)),
      };
      void saveLibraryIndex(pruned).catch((error) => {
        setStorageError(error instanceof Error ? error.message : "Kitaplık dizini yazılamadı.");
      });

      hydrated.current = true;
      setHydrating(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  // Kitaplık dizinini JSON olarak diske yaz (gecikmeli, her tuşta değil).
  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => {
      const index: LibraryIndex = {
        version: 2,
        entries: entries
          .map(toPersisted)
          .filter((entry): entry is PersistedEntry => !!entry),
        trash: trashed
          .map(toPersisted)
          .filter((entry): entry is PersistedEntry => !!entry),
        trashRecords,
      };
      void saveLibraryIndex(index).catch((error) => {
        setStorageError(error instanceof Error ? error.message : "Kitaplık yazılamadı.");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [entries, trashed, trashRecords]);

  const purgeExpired = useCallback(() => {
    const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000;
    const expired = trashedRef.current.filter((entry) => (entry.trashedAt ?? 0) < cutoff);
    if (expired.length === 0) return;
    for (const entry of expired) {
      releaseUrl(entry.url);
      seen.current.delete(entry.key);
      if (entry.path) void deleteStored(entry.path);
    }
    const keys = new Set(expired.map((entry) => entry.key));
    setTrashed((current) => current.filter((entry) => !keys.has(entry.key)));
    setTrashRecords((records) => [
      ...expired.map((entry) => ({ ...toTrashRecord(entry), deletedAt: cutoff })),
      ...records,
    ]);
  }, []);

  useEffect(() => {
    if (!hydrating) purgeExpired();
  }, [hydrating, purgeExpired]);

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
    if (fresh.length === 0) return fresh;

    const freshKeys = new Set(fresh.map((entry) => entry.key));
    const duplicatesInTrash = trashedRef.current.filter((entry) =>
      freshKeys.has(entry.key),
    );
    for (const duplicate of duplicatesInTrash) {
      releaseUrl(duplicate.url);
      if (duplicate.path) void deleteStored(duplicate.path);
    }
    if (duplicatesInTrash.length > 0) {
      setTrashed((current) => current.filter((entry) => !freshKeys.has(entry.key)));
    }
    setTrashRecords((records) =>
      records.filter((record) => !freshKeys.has(record.key)),
    );

    setEntries((prev) => [...fresh, ...prev]);

    // Dosyaları uygulamanın özel depolamasına kopyala; gizli klasör dahil.
    for (const entry of fresh) {
      void (async () => {
        try {
          const path = await persistBlob(
            entry.file,
            `${entry.id}.${extensionOf(entry.name)}`,
          );
          setEntries((prev) =>
            prev.map((item) =>
              item.id === entry.id ? { ...item, path, persisted: true } : item,
            ),
          );
          setTrashed((prev) =>
            prev.map((item) =>
              item.id === entry.id ? { ...item, path, persisted: true } : item,
            ),
          );
        } catch (error) {
          setStorageError(
            error instanceof Error
              ? error.message
              : "Dosya kalıcı depoya kopyalanamadı.",
          );
        }
      })();
    }

    return fresh;
  }, []);

  const byId = useCallback(
    (id: string) => entries.find((entry) => entry.id === id),
    [entries],
  );

  const remove = useCallback((id: string) => {
    const target = entriesRef.current.find((entry) => entry.id === id);
    if (!target) return;
    releaseUrl(target.url);
    seen.current.delete(target.key);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    if (target.path) void deleteStored(target.path);
  }, []);

  const trash = useCallback((id: string) => {
    const target = entriesRef.current.find((entry) => entry.id === id);
    if (!target) return false;
    const moved: Entry = { ...target, trashedAt: Date.now() };
    seen.current.delete(target.key);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    setTrashed((prev) => [moved, ...prev]);
    return true;
  }, []);

  const restore = useCallback((key: string) => {
    const target = trashedRef.current.find((entry) => entry.key === key);
    if (!target) return false;
    const restored: Entry = { ...target, trashedAt: undefined };
    setTrashed((prev) => prev.filter((entry) => entry.key !== key));
    setEntries((prev) => [restored, ...prev]);
    seen.current.add(restored.key);
    return true;
  }, []);

  const purgeTrash = useCallback(() => {
    const targets = trashedRef.current;
    for (const entry of targets) {
      releaseUrl(entry.url);
      seen.current.delete(entry.key);
      if (entry.path) void deleteStored(entry.path);
    }
    setTrashed([]);
    if (targets.length > 0) {
      setTrashRecords((records) => [...targets.map(toTrashRecord), ...records]);
    }
  }, []);

  const toggleFavorite = useCallback((key: string) => {
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [key, ...prev],
    );
  }, []);

  const toggleHidden = useCallback((key: string) => {
    setHidden((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [key, ...prev],
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
    setAlbums((prev) => prev.filter((album) => album.id !== albumId));
  }, []);

  const dismissStorageError = useCallback(() => setStorageError(null), []);

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
      hydrating,
      storageError,
      dismissStorageError,
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
      hydrating,
      storageError,
      dismissStorageError,
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

