import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

/**
 * Uygulamanın özel depolaması (Android: files/, web: IndexedDB).
 * Kitaplık dosyaları, editör projeleri ve indirilen paketler burada tutulur.
 */
export const STORAGE_ROOT = "beytool";
export const LIBRARY_DIR = `${STORAGE_ROOT}/library`;
export const PROJECT_DIR = `${STORAGE_ROOT}/projects`;
export const PACK_DIR = `${STORAGE_ROOT}/packs`;
export const ASSET_DIR = `${STORAGE_ROOT}/assets`;
const INDEX_FILE = `${STORAGE_ROOT}/library.json`;

const DATA = Directory.Data;

/**
 * Capacitor köprüsü JS→Java mesajını tek bir JSON dizesi olarak çözer.
 * Büyük dosyayı tek parça göndermek (ör. 120 MB video → 160 MB base64)
 * Android tarafında OutOfMemoryError'a yol açar. Bu yüzden dosyalar
 * köprü için güvenli boyutta parçalara bölünür.
 */
const BRIDGE_CHUNK = 4 * 1024 * 1024;

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Dosya okunamadı."));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64ToBlob(base64: string, type: string): Blob {
  return new Blob([base64ToBytes(base64)], { type: type || "application/octet-stream" });
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Blob'u parça parça yazar. Her parça birkaç MB'lık base64 olduğu için
 * Android köprüsü tek seferde yüzlerce MB ayırmak zorunda kalmaz.
 * Yazma yarıda kalırsa geride bozuk dosya bırakmaz.
 */
export async function writeBlobFile(
  path: string,
  blob: Blob,
  directory = DATA,
): Promise<string> {
  if (Capacitor.getPlatform() === "web") {
    const written = await Filesystem.writeFile({
      path,
      data: blob,
      directory,
      recursive: true,
    });
    return written.uri;
  }

  try {
    if (blob.size === 0) {
      const written = await Filesystem.writeFile({
        path,
        data: "",
        directory,
        recursive: true,
        encoding: Encoding.UTF8,
      });
      return written.uri;
    }

    let firstUri = "";
    for (let offset = 0; offset < blob.size; offset += BRIDGE_CHUNK) {
      const chunk = blob.slice(offset, Math.min(offset + BRIDGE_CHUNK, blob.size));
      const data = await blobToBase64(chunk);
      if (offset === 0) {
        const written = await Filesystem.writeFile({
          path,
          data,
          directory,
          recursive: true,
        });
        firstUri = written.uri;
      } else {
        await Filesystem.appendFile({ path, data, directory });
      }
    }
    return firstUri;
  } catch (error) {
    try {
      await Filesystem.deleteFile({ path, directory });
    } catch {
      // Yarım dosya zaten yoksa yoksay.
    }
    throw error;
  }
}

/** Dosyayı özel depoya yazar ve kalıcı yolunu döndürür. */
export async function persistBlob(
  blob: Blob,
  fileName: string,
  directory = LIBRARY_DIR,
): Promise<string> {
  const path = `${directory}/${safeSegment(fileName)}`;
  await writeBlobFile(path, blob, DATA);
  return path;
}

/**
 * Dosyayı köprüyü tıkamadan okur. Yerelde dosya parça parça okunur;
 * tek seferlik base64 okuması büyük videolarda Java tarafını da şişirir.
 */
export async function readStoredBlob(
  path: string,
  type = "application/octet-stream",
): Promise<Blob> {
  if (Capacitor.getPlatform() !== "web") {
    try {
      const info = await Filesystem.stat({ path, directory: DATA });
      const size = info.size;
      if (size > 0) {
        const parts: BlobPart[] = [];
        let offset = 0;
        while (offset < size) {
          const length = Math.min(BRIDGE_CHUNK, size - offset);
          const result = await Filesystem.readFile({
            path,
            directory: DATA,
            offset,
            length,
          });
          if (typeof result.data !== "string") return result.data;
          const bytes = base64ToBytes(result.data);
          // Eklenti offset'i yok sayarsa tüm dosyayı tekrar okumaya çalışma.
          if (bytes.length === 0 || bytes.length > length) break;
          parts.push(bytes);
          offset += bytes.length;
          if (bytes.length < length) break;
        }
        if (parts.length > 0) return new Blob(parts, { type });
      }
    } catch {
      // Parçalı okuma desteklenmiyorsa aşağıdaki tek okumaya düş.
    }
  }

  const result = await Filesystem.readFile({ path, directory: DATA });
  if (result.data instanceof Blob) return result.data;
  return base64ToBlob(String(result.data), type);
}

/** Kalıcı dosyayı yalnızca gerektiğinde File olarak okur (mobilde bellek tasarrufu). */
export async function readStoredFile(
  path: string,
  name: string,
  type = "application/octet-stream",
  lastModified = Date.now(),
): Promise<File> {
  const blob = await readStoredBlob(path, type);
  return new File([blob], name, { type, lastModified });
}

/**
 * Dosyanın cihazdaki file:// adresi. WebView bu adresi yerel sunucu üzerinden
 * açar; böylece video/görsel belleğe kopyalanmadan, akış olarak oynatılır.
 */
export async function storedFileUri(path: string): Promise<string> {
  const result = await Filesystem.getUri({ path, directory: DATA });
  return result.uri;
}

export async function deleteStored(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path, directory: DATA });
  } catch {
    // Dosya zaten yoksa yoksay.
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await Filesystem.writeFile({
    path,
    data: JSON.stringify(value),
    directory: DATA,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: DATA,
      encoding: Encoding.UTF8,
    });
    if (typeof result.data !== "string" || !result.data) return null;
    return JSON.parse(result.data) as T;
  } catch {
    return null;
  }
}

export async function listStored(directory: string): Promise<{ name: string; size: number }[]> {
  try {
    const result = await Filesystem.readdir({ path: directory, directory: DATA });
    return result.files
      .filter((file) => file.type === "file")
      .map((file) => ({ name: file.name, size: file.size ?? 0 }));
  } catch {
    return [];
  }
}

export async function listDirectories(directory: string): Promise<string[]> {
  try {
    const result = await Filesystem.readdir({ path: directory, directory: DATA });
    return result.files
      .filter((file) => file.type === "directory")
      .map((file) => file.name);
  } catch {
    return [];
  }
}

export type LibraryIndex = {
  version: 2;
  entries: PersistedEntry[];
  trash: PersistedEntry[];
  trashRecords: PersistedTrashRecord[];
};

export type PersistedEntry = {
  id: string;
  key: string;
  name: string;
  size: number;
  type: string;
  kind: "video" | "audio" | "image" | "other";
  folder: string;
  addedAt: number;
  lastModified: number;
  path: string;
  deletedAt?: number;
};

export type PersistedTrashRecord = {
  key: string;
  name: string;
  size: number;
  kind: "video" | "audio" | "image" | "other";
  folder: string;
  deletedAt: number;
};

export async function loadLibraryIndex(): Promise<LibraryIndex> {
  const index = await readJson<LibraryIndex>(INDEX_FILE);
  if (!index || index.version !== 2) {
    return { version: 2, entries: [], trash: [], trashRecords: [] };
  }
  return {
    version: 2,
    entries: Array.isArray(index.entries) ? index.entries.filter((e) => e?.path) : [],
    trash: Array.isArray(index.trash) ? index.trash.filter((e) => e?.path) : [],
    trashRecords: Array.isArray(index.trashRecords) ? index.trashRecords : [],
  };
}

export async function saveLibraryIndex(index: LibraryIndex): Promise<void> {
  await writeJson(INDEX_FILE, index);
}

export function storagePathFor(prefix: string, id: string, extension: string): string {
  const ext = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${prefix}/${safeSegment(id)}.${ext}`;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "bin" : name.slice(dot + 1).toLowerCase();
}
