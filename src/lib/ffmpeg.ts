import type { FFmpeg } from "@ffmpeg/ffmpeg";

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

/** Büyük dosyalarda FFmpeg.wasm belleği zorlanabilir; bu eşikte uyarı gösterilir. */
export const FFMPEG_WARN_BYTES = 200 * 1024 * 1024;

export class FFmpegCancelledError extends Error {
  constructor() {
    super("İşlem iptal edildi.");
    this.name = "FFmpegCancelledError";
  }
}

export function isFFmpegCancelled(error: unknown): boolean {
  return (
    error instanceof FFmpegCancelledError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * FFmpeg.wasm'ı yalnızca bir kez, yerel paketlenmiş çekirdekle yükler.
 * Dosya public/ffmpeg/ altından gelir (scripts/prepare-assets.mjs kopyalar).
 */
export function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      const { FFmpeg: FFmpegClass } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpegClass();
      const base = import.meta.env.BASE_URL;
      await ffmpeg.load({
        coreURL: `${base}ffmpeg/ffmpeg-core.js`,
        wasmURL: `${base}ffmpeg/ffmpeg-core.wasm`,
      });
      instance = ffmpeg;
      return ffmpeg;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/**
 * Çalışan FFmpeg işini gerçekten durdurur (worker sonlandırılır) ve bir sonraki
 * çağrıda temiz bir örnek yüklenmesini sağlar.
 */
export function cancelFFmpeg(): void {
  const current = instance;
  instance = null;
  loading = null;
  try {
    current?.terminate();
  } catch {
    // Worker zaten kapanmış olabilir.
  }
}

export function assertFFmpegAlive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new FFmpegCancelledError();
}

/**
 * exec + ilerleme + iptal. AbortSignal tetiklendiğinde worker sonlandırılır;
 * işlem FFmpegCancelledError ile biter.
 */
export async function execFFmpeg(
  ffmpeg: FFmpeg,
  args: string[],
  options: {
    onProgress?: (ratio: number) => void;
    signal?: AbortSignal;
    timeout?: number;
  } = {},
): Promise<number> {
  const { onProgress, signal, timeout } = options;
  assertFFmpegAlive(signal);

  const onProgressEvent = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  const onAbort = () => cancelFFmpeg();

  ffmpeg.on("progress", onProgressEvent);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const code = await ffmpeg.exec(args, timeout, { signal });
    assertFFmpegAlive(signal);
    return code;
  } catch (error) {
    if (signal?.aborted) throw new FFmpegCancelledError();
    throw error;
  } finally {
    ffmpeg.off("progress", onProgressEvent);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function ffmpegExtension(name: string): string {
  const match = name.match(/\.([^.]+)$/);
  const ext = match?.[1]?.toLowerCase() ?? "mp4";
  const safe = ext.replace(/[^a-z0-9]/g, "");
  return safe || "mp4";
}

export function mimeForExt(ext: string): string {
  switch (ext) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}
