import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { strFromU8, unzipSync } from "fflate";
import {
  PACK_DIR,
  base64ToBytes,
  bytesToBase64,
  deleteStored,
  listDirectories,
  persistBlob,
  readJson,
  readStoredBlob,
} from "@/lib/storage";
import type { CatalogPack, InstalledPack, PackContent, PackItem } from "./types";
import { PackError } from "./types";
import { packManifest } from "./manifest";

const DATA = Directory.Data;

type PackDownloaderApi = {
  download: (options: { url: string; path: string }) => Promise<{ path: string }>;
  cancel: () => Promise<void>;
  addListener: (
    event: "progress",
    listener: (data: { received: number; total: number }) => void,
  ) => Promise<PluginListenerHandle>;
};

const PackDownloader = registerPlugin<PackDownloaderApi>("PackDownloader");

export type DownloadProgress = (received: number, total: number) => void;

function zipPath(packId: string): string {
  return `${PACK_DIR}/${packId}.zip`;
}

export function packDir(packId: string): string {
  return `${PACK_DIR}/${packId}`;
}

export function packAssetPath(packId: string, file: string): string {
  return `${packDir(packId)}/${file}`;
}

export function isPackCancelled(error: unknown): boolean {
  return error instanceof PackError && error.code === "cancelled";
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", view);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof PackError) return error.code === "network";
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|network|internet|connection|timeout|unreachable/i.test(message);
}

/** Tarayıcıda akışlı indirme; ilerleme ve iptal destekler. */
async function downloadWeb(
  pack: CatalogPack,
  url: string,
  onProgress?: DownloadProgress,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: "no-store" });
  } catch (error) {
    if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
    if (isNetworkFailure(error)) {
      // Tarayıcıda GitHub Release indirmeleri CORS başlığı taşımadığı için
      // fetch engellenir; APK'da yerel indirici kullanılır.
      if (typeof navigator !== "undefined" && navigator.onLine !== false) {
        throw new PackError("browser", "Tarayıcı indirmeyi engelledi.");
      }
      throw new PackError("network", "Paket için internet gerekli.");
    }
    throw new PackError("server", error instanceof Error ? error.message : "İndirme başarısız.");
  }
  if (!response.ok) {
    throw new PackError("server", `HTTP ${response.status}`);
  }
  const total = Number(response.headers.get("content-length")) || pack.size;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new PackError("server", "İndirme akışı açılamadı.");
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onProgress?.(received, total || received);
      }
    }
  } catch (error) {
    if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
    if (isNetworkFailure(error)) {
      throw new PackError("network", "Paket için internet gerekli.");
    }
    throw error;
  }
  if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
  const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
  await persistBlob(blob, `${pack.id}.zip`, PACK_DIR);
}

/** Android'de CORS'a takılmadan indiren yerel eklenti. */
async function downloadNative(
  pack: CatalogPack,
  url: string,
  onProgress?: DownloadProgress,
  signal?: AbortSignal,
): Promise<void> {
  let handle: PluginListenerHandle | null = null;
  const onAbort = () => {
    void PackDownloader.cancel().catch(() => undefined);
  };
  try {
    handle = await PackDownloader.addListener("progress", (data) => {
      onProgress?.(data.received, data.total || pack.size);
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    await PackDownloader.download({ url, path: zipPath(pack.id) });
    if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
  } catch (error) {
    if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
    const message = error instanceof Error ? error.message : String(error);
    if (/^HTTP\s+\d+/i.test(message)) {
      throw new PackError("server", message);
    }
    throw new PackError("network", "Paket için internet gerekli.");
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await handle?.remove();
  }
}

async function readZipBytes(path: string): Promise<Uint8Array> {
  const result = await Filesystem.readFile({ path, directory: DATA });
  if (typeof result.data === "string") return base64ToBytes(result.data);
  return new Uint8Array(await result.data.arrayBuffer());
}

async function removePackDir(packId: string): Promise<void> {
  try {
    await Filesystem.rmdir({ path: packDir(packId), directory: DATA, recursive: true });
  } catch {
    // Klasör zaten yoksa yoksay.
  }
}

function safeEntry(name: string): string {
  const normalized = name.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.split("/").some((part) => part === "..")
  ) {
    throw new PackError("invalid", "Paket içinde geçersiz dosya yolu var.");
  }
  return normalized;
}

function parseContent(raw: string): PackContent {
  const value = JSON.parse(raw) as PackContent;
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.kind !== "string" ||
    !Array.isArray(value.items) ||
    typeof value.version !== "number"
  ) {
    throw new PackError("invalid", "Paket tanımı okunamadı.");
  }
  return value;
}

/**
 * Paketi indirir, SHA-256 doğrular, açar ve kalıcı depoya yazar.
 * Doğrulama başarısız olursa hiçbir dosya bırakmaz.
 */
export async function installPack(
  pack: CatalogPack,
  options: {
    onProgress?: DownloadProgress;
    signal?: AbortSignal;
  } = {},
): Promise<InstalledPack> {
  const { signal, onProgress } = options;
  if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new PackError("network", "Paket için internet gerekli.");
  }

  const url = `${packManifest.baseUrl.replace(/\/+$/, "")}/${pack.file}`;
  if (Capacitor.isNativePlatform()) {
    await downloadNative(pack, url, onProgress, signal);
  } else {
    await downloadWeb(pack, url, onProgress, signal);
  }

  const path = zipPath(pack.id);
  let installed: InstalledPack | null = null;
  try {
    if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
    const bytes = await readZipBytes(path);
    onProgress?.(bytes.byteLength, bytes.byteLength);
    const digest = await sha256Hex(bytes);
    if (digest.toLowerCase() !== pack.sha256.toLowerCase()) {
      throw new PackError("hash", "Paket bütünlük kontrolü başarısız.");
    }

    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new PackError("invalid", "Paket arşivi açılamadı.");
    }
    const manifestBytes = entries["pack.json"];
    if (!manifestBytes) {
      throw new PackError("invalid", "Paket tanımı eksik.");
    }
    const content = parseContent(strFromU8(manifestBytes));
    if (content.id !== pack.id || content.kind !== pack.kind) {
      throw new PackError("invalid", "Paket kimliği uyuşmuyor.");
    }
    if (content.version !== pack.version) {
      throw new PackError("invalid", "Paket sürümü manifest ile uyuşmuyor.");
    }

    const names = Object.keys(entries);
    const totalBytes = names.reduce((sum, name) => sum + entries[name].byteLength, 0);
    if (names.length > 200 || totalBytes > 32 * 1024 * 1024) {
      throw new PackError("invalid", "Paket beklenenden büyük.");
    }

    await removePackDir(pack.id);
    for (const rawName of names) {
      if (rawName === "pack.json") continue;
      const name = safeEntry(rawName);
      if (name.endsWith("/")) continue;
      await Filesystem.mkdir({
        path: packDir(pack.id),
        directory: DATA,
        recursive: true,
      });
      await Filesystem.writeFile({
        path: `${packDir(pack.id)}/${name}`,
        data: bytesToBase64(entries[rawName]),
        directory: DATA,
        recursive: true,
      });
    }

    const installedAt = Date.now();
    installed = {
      ...content,
      installedAt,
      dir: packDir(pack.id),
    };
    await Filesystem.writeFile({
      path: `${packDir(pack.id)}/pack.json`,
      data: JSON.stringify({ ...content, installedAt }),
      directory: DATA,
      recursive: true,
      encoding: Encoding.UTF8,
    });
  } catch (error) {
    await removePackDir(pack.id);
    if (error instanceof PackError) throw error;
    if (signal?.aborted) throw new PackError("cancelled", "İptal edildi.");
    throw new PackError(
      "storage",
      error instanceof Error ? error.message : "Paket yazılamadı.",
    );
  } finally {
    await deleteStored(path);
  }

  if (!installed) {
    throw new PackError("invalid", "Paket kurulamadı.");
  }
  return installed;
}

export async function listInstalledPacks(): Promise<InstalledPack[]> {
  const dirs = await listDirectories(PACK_DIR);
  const packs: InstalledPack[] = [];
  for (const dir of dirs) {
    const content = await readJson<PackContent & { installedAt?: number }>(
      `${PACK_DIR}/${dir}/pack.json`,
    );
    if (!content || content.id !== dir || !Array.isArray(content.items)) continue;
    packs.push({
      ...content,
      installedAt: content.installedAt ?? 0,
      dir: `${PACK_DIR}/${dir}`,
    });
  }
  return packs.sort((a, b) => a.title.tr.localeCompare(b.title.tr, "tr"));
}

export async function removePack(packId: string): Promise<void> {
  await deleteStored(zipPath(packId));
  await removePackDir(packId);
}

/* ------------------------------------------------------------------ */
/* Paket içeriğine erişim                                              */
/* ------------------------------------------------------------------ */

const assetUrls = new Map<string, string>();

function mimeForFile(file: string): string {
  const extension = file.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "ttf") return "font/ttf";
  if (extension === "otf") return "font/otf";
  return "application/octet-stream";
}

export async function readPackAssetBlob(packId: string, file: string): Promise<Blob> {
  return readStoredBlob(packAssetPath(packId, file), mimeForFile(file));
}

export async function packAssetUrl(packId: string, file: string): Promise<string> {
  const key = `${packId}/${file}`;
  const cached = assetUrls.get(key);
  if (cached) return cached;
  const blob = await readPackAssetBlob(packId, file);
  const url = URL.createObjectURL(blob);
  assetUrls.set(key, url);
  return url;
}

export function revokePackAssets(packId: string): void {
  for (const [key, url] of assetUrls) {
    if (key.startsWith(`${packId}/`)) {
      URL.revokeObjectURL(url);
      assetUrls.delete(key);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Paket fontları                                                      */
/* ------------------------------------------------------------------ */

const fontFaces = new Map<string, FontFace>();

function fontKey(packId: string, itemId: string): string {
  return `${packId}:${itemId}`;
}

export function packFontId(packId: string, itemId: string): string {
  return `pack:${packId}:${itemId}`;
}

export function packFontFamily(packId: string, itemId: string): string {
  return `BeyTool ${packId} ${itemId}`.replace(/[^a-zA-Z0-9 ]+/g, " ").trim();
}

export async function registerPackFont(packId: string, item: PackItem): Promise<void> {
  if (!item.file) return;
  const key = fontKey(packId, item.id);
  if (fontFaces.has(key)) return;
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const blob = await readPackAssetBlob(packId, item.file);
  const face = new FontFace(packFontFamily(packId, item.id), await blob.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  fontFaces.set(key, face);
}

export function unregisterPackFonts(packId: string): void {
  for (const [key, face] of fontFaces) {
    if (!key.startsWith(`${packId}:`)) continue;
    try {
      document.fonts.delete(face);
    } catch {
      // Yazı tipi zaten kaldırılmış olabilir.
    }
    fontFaces.delete(key);
  }
}

/** Metin klibindeki font kimliğini CSS ailesine çevirir. */
export function fontFamilyFor(fontId: string): string | undefined {
  if (!fontId.startsWith("pack:")) return undefined;
  const [, packId, itemId] = fontId.split(":");
  if (!packId || !itemId) return undefined;
  const face = fontFaces.get(fontKey(packId, itemId));
  if (!face) return undefined;
  return `"${face.family}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
}

export async function ensureFontLoaded(fontId: string, pixels: number): Promise<void> {
  if (!fontId.startsWith("pack:")) return;
  const [, packId, itemId] = fontId.split(":");
  if (!packId || !itemId) return;
  const face = fontFaces.get(fontKey(packId, itemId));
  if (!face) return;
  try {
    await document.fonts.load(`600 ${Math.max(12, Math.round(pixels))}px "${face.family}"`);
  } catch {
    // Font yüklenemezse sistem yazı tipiyle devam edilir.
  }
}

