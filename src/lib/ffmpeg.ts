import type { FFmpeg } from "@ffmpeg/ffmpeg";

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

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
    default:
      return "application/octet-stream";
  }
}
