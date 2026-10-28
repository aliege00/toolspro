export type Kind = "video" | "audio" | "image" | "other";

/** ZIP oluştururken toplam boyut bu eşiği aşarsa bellek uyarısı gösterilir. */
export const ARCHIVE_WARN_BYTES = 300 * 1024 * 1024;
/** OCR büyük görsellerde uzun sürer; bu eşikte uyarı gösterilir. */
export const OCR_WARN_BYTES = 12 * 1024 * 1024;

const VIDEO_EXT = [
  "mp4", "m4v", "mkv", "webm", "mov", "avi", "3gp", "ts", "flv", "wmv", "mpg", "mpeg", "ogv", "vob",
];
const AUDIO_EXT = [
  "mp3", "m4a", "aac", "wav", "flac", "ogg", "oga", "opus", "wma", "amr", "mid",
];
const IMAGE_EXT = [
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "svg", "avif", "tif", "tiff",
];

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function detectKind(file: File): Kind {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  const ext = extOf(file.name);
  if (VIDEO_EXT.includes(ext)) return "video";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (IMAGE_EXT.includes(ext)) return "image";
  return "other";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--:--";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function baseName(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? name : name.slice(0, i);
}

export function replaceExt(name: string, ext: string): string {
  return `${baseName(name)}.${ext}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PickOptions = {
  multiple?: boolean;
  accept?: string;
  directory?: boolean;
};

/** Sistem dosya seçicisini açar (WebView'da Android SAF picker'ı). */
export function pickFiles(opts: PickOptions = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = opts.multiple ?? false;
    if (opts.accept) input.accept = opts.accept;
    if (opts.directory) {
      input.setAttribute("webkitdirectory", "");
    }

    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };

    input.addEventListener("change", () => finish(Array.from(input.files ?? [])));
    input.addEventListener("cancel", () => finish([]));
    input.click();
  });
}

let thumbCounter = 0;

/** Videodan küçük kare üretir; üretilemezse null döner. */
export function videoThumb(url: string, atSeconds = 1): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    video.onloadeddata = () => {
      const total = video.duration;
      const target =
        isFinite(total) && total > 0
          ? Math.min(atSeconds, Math.max(0, total * 0.1))
          : 0;
      video.currentTime = target;
    };
    video.onseeked = () => {
      window.clearTimeout(timer);
      try {
        const width = video.videoWidth || 320;
        const height = video.videoHeight || 180;
        const scale = Math.min(1, 320 / width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.6);
        cleanup();
        resolve(data);
      } catch {
        cleanup();
        resolve(null);
      }
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };
  });
}

export function newId(): string {
  thumbCounter += 1;
  return `${Date.now().toString(36)}-${thumbCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Blob'u indirilebilir hale getirir (tarayıcı/önizleme). */
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export { triggerDownload };
