import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { triggerDownload } from "./files";

type PermissionsApi = {
  request: () => Promise<{ granted: boolean }>;
  check: () => Promise<{ granted: boolean }>;
  requestCamera: () => Promise<{ granted: boolean }>;
  requestMic: () => Promise<{ granted: boolean }>;
  requestNotifications: () => Promise<{ granted: boolean }>;
};

/** Uygulamanın kendi Capacitor eklentisi (android/MediaPermissionsPlugin). */
export const MediaPermissions = registerPlugin<PermissionsApi>("MediaPermissions");

export type AudioNotificationPayload = {
  title: string;
  duration: number;
  position: number;
  playing: boolean;
};

export type AudioNotificationAction = {
  action: "play" | "pause" | "next" | "previous" | "seek";
  position?: number;
};

type AudioNotificationApi = {
  start: (options: AudioNotificationPayload) => Promise<void>;
  update: (options: AudioNotificationPayload) => Promise<void>;
  stop: () => Promise<void>;
  addListener: (
    event: "action",
    listener: (data: AudioNotificationAction) => void,
  ) => Promise<PluginListenerHandle>;
};

/** Kilit ekranı / bildirim medya kontrolleri (android/AudioNotificationPlugin). */
export const AudioNotification = registerPlugin<AudioNotificationApi>("AudioNotification");

type GalleryApi = {
  save: (options: {
    path: string;
    fileName: string;
    mimeType: string;
  }) => Promise<{ uri: string }>;
};

/** Galeriye video kaydı (android/GalleryPlugin). */
export const Gallery = registerPlugin<GalleryApi>("Gallery");

export type DeviceDiagnosticsInfo = {
  freeBytes?: number;
  totalBytes?: number;
  memoryFreeBytes?: number;
  memoryTotalBytes?: number;
  lowMemory?: boolean;
  sdk?: number;
  device?: string;
  android?: string;
  storageError?: string;
  memoryError?: string;
};

type DeviceDiagnosticsApi = {
  info: () => Promise<DeviceDiagnosticsInfo>;
};

/** Cihaz depolama/bellek bilgisi (android/DeviceDiagnosticsPlugin). */
export const DeviceDiagnostics = registerPlugin<DeviceDiagnosticsApi>("DeviceDiagnostics");

export async function readDeviceDiagnostics(): Promise<DeviceDiagnosticsInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await DeviceDiagnostics.info();
  } catch {
    return null;
  }
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Android'de gerçek runtime izni ister (READ_MEDIA_* / READ_EXTERNAL_STORAGE).
 * Web'de sistem dosya seçicisi zaten izin sorar, bu yüzden doğrudan true döner.
 */
export async function requestMediaAccess(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const res = await MediaPermissions.request();
    return res.granted;
  } catch {
    return false;
  }
}

/** Kamera izni (QR tarama) — tarayıcıda sistem sorusu yeterlidir. */
export async function requestCameraAccess(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const res = await MediaPermissions.requestCamera();
    return res.granted;
  } catch {
    return false;
  }
}

/** Mikrofon izni (ses kaydedici) — tarayıcıda sistem sorusu yeterlidir. */
export async function requestMicAccess(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const res = await MediaPermissions.requestMic();
    return res.granted;
  } catch {
    return false;
  }
}

/** Bildirim izni (arka plan ses çalar) — Android 13+ için gerekir. */
export async function requestNotificationAccess(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const res = await MediaPermissions.requestNotifications();
    return res.granted;
  } catch {
    return false;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export type SaveResult = "shared" | "downloaded" | "failed";

async function writeCache(blob: Blob, fileName: string): Promise<string> {
  const data = await blobToBase64(blob);
  const written = await Filesystem.writeFile({
    path: `medya/${fileName}`,
    data,
    directory: Directory.Cache,
    recursive: true,
  });
  return written.uri;
}

/** Videoyu doğrudan galeriye kaydeder (tarayıcıda indirir). */
export async function saveToGallery(
  blob: Blob,
  fileName: string,
  mimeType = "video/mp4",
): Promise<boolean> {
  if (!isNative()) {
    triggerDownload(blob, fileName);
    return true;
  }
  try {
    const path = await writeCache(blob, fileName);
    await Gallery.save({ path, fileName, mimeType });
    return true;
  } catch {
    return false;
  }
}

/** Sistem paylaşma sayfasını açar (tarayıcıda indirir). */
export async function shareBlob(blob: Blob, fileName: string): Promise<boolean> {
  if (!isNative()) {
    triggerDownload(blob, fileName);
    return true;
  }
  try {
    const path = await writeCache(blob, fileName);
    await Share.share({
      title: fileName,
      dialogTitle: "Videoyu paylaş",
      files: [path],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Çıktıyı cihaza kaydetmeye çalışır.
 * - Android: önce paylaşma sayfası açılır (dosya aktarımı), olmazsa İndirilenler'e yazar.
 * - Tarayıcı: dosya indirilir.
 */
export async function saveBlob(blob: Blob, fileName: string): Promise<SaveResult> {
  if (!isNative()) {
    triggerDownload(blob, fileName);
    return "downloaded";
  }

  let data: string;
  try {
    data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: `medya/${fileName}`,
      data,
      directory: Directory.Cache,
      recursive: true,
    });

    try {
      await Share.share({
        title: fileName,
        dialogTitle: "Dosyayı kaydet",
        files: [written.uri],
      });
      return "shared";
    } catch {
      // Paylaşma penceresi açılmadı: Belgeler klasörüne yazmayı dene.
    }
  } catch {
    return "failed";
  }

  try {
    await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Documents,
    });
    return "shared";
  } catch {
    // Tarayıcı (WebView) blob indirmesini dosya yöneticisine yazamaz;
    // dürüst olmak için başarısız döndür.
    return "failed";
  }
}
