import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { triggerDownload } from "./files";

type PermissionsApi = {
  request: () => Promise<{ granted: boolean }>;
  check: () => Promise<{ granted: boolean }>;
};

/** Uygulamanın kendi Capacitor eklentisi (android/MediaPermissionsPlugin). */
export const MediaPermissions = registerPlugin<PermissionsApi>("MediaPermissions");

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

  try {
    const data = await blobToBase64(blob);
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
      // Paylaşma iptal edildi veya desteklenmiyor: indirilenlere yazmayı dene.
      await Filesystem.writeFile({
        path: fileName,
        data,
        directory: Directory.Documents,
      });
      return "shared";
    }
  } catch {
    try {
      triggerDownload(blob, fileName);
      return "downloaded";
    } catch {
      return "failed";
    }
  }
}
