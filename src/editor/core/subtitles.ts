import type { Cue } from "@/lib/srt";
import { textClip } from "./model";
import type { Clip } from "./model";

/** Altyazılar normal metin kliplerinden biraz küçük çizilir. */
export const SUBTITLE_SIZE = 34;

export type SubtitleOptions = {
  /** Dosyanın 0. saniyesi zaman çizelgesinde hangi ana denk gelsin. */
  offset?: number;
  /** Çok kısa altyazılar okunaksız olur; bu süreden kısa tutulmaz. */
  minDuration?: number;
  /** Tek altyazının taşıyabileceği en uzun süre. */
  maxDuration?: number;
};

/**
 * SRT kliplerini metin kliplerine çevirir:
 * - alt hizalı, ortalanmış, animasyonsuz, beyaz,
 * - çakışan veya üst üste binen klipler kırpılır/sıraya sokulur,
 * - bozuk/boş satırlar atlanır.
 * Saf fonksiyondur; React veya FFmpeg bilmez.
 */
export function subtitleClips(cues: Cue[], options: SubtitleOptions = {}): Clip[] {
  const { offset = 0, minDuration = 0.6, maxDuration = 10 } = options;
  const clips: Clip[] = [];
  let cursor = Number.NEGATIVE_INFINITY;

  for (const cue of cues) {
    const content = cue.text.trim();
    if (!content) continue;
    if (!Number.isFinite(cue.start) || cue.start < 0) continue;
    // Bitişi başlangıcından önce olan bozuk cue üretilmez.
    if (Number.isFinite(cue.end) && cue.end <= cue.start) continue;

    const safeEnd =
      Number.isFinite(cue.end) && cue.end > cue.start
        ? cue.end
        : cue.start + minDuration;
    const duration = Math.min(
      maxDuration,
      Math.max(minDuration, safeEnd - cue.start),
    );
    const start = Math.max(offset + cue.start, cursor, 0);
    const end = start + duration;
    if (end - start < 0.05) continue;

    const clip = textClip(start, end - start);
    clip.name = content.length > 32 ? `${content.slice(0, 32)}…` : content;
    clip.transitionIn = "none";
    clip.text = {
      ...clip.text!,
      content,
      size: SUBTITLE_SIZE,
      color: "#ffffff",
      align: "center",
      vAlign: "bottom",
      animIn: "none",
      animOut: "none",
    };
    clips.push(clip);
    cursor = end;
  }

  return clips;
}
