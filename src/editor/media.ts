import type { Entry } from "@/lib/library";
import type { Clip, Track } from "./types";
import { clipEnd } from "./types";

/** Video/ses süresini tarayıcı medya öğesinden okur; okunamazsa 5 sn varsayar. */
export function probeDuration(entry: Entry): Promise<number> {
  if (entry.kind === "image") return Promise.resolve(4);
  if (entry.kind !== "video" && entry.kind !== "audio") return Promise.resolve(5);

  return new Promise((resolve) => {
    const element = document.createElement(entry.kind === "audio" ? "audio" : "video");
    element.preload = "metadata";
    element.muted = true;
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      element.removeAttribute("src");
      element.load();
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(5), 8000);
    element.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = element.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : 5);
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      finish(5);
    };
    element.src = entry.url;
  });
}

export function resolveEntry(clip: Clip, entries: Entry[]): Entry | undefined {
  if (clip.entryId) {
    const byId = entries.find((entry) => entry.id === clip.entryId);
    if (byId) return byId;
  }
  if (clip.entryKey) {
    return entries.find((entry) => entry.key === clip.entryKey);
  }
  return undefined;
}

/** Zaman çizelgesi anını klip içi kaynak saniyesine çevirir. */
export function sourceTime(clip: Clip, timelineTime: number): number {
  const local = Math.max(0, Math.min(clip.duration, timelineTime - clip.start));
  const raw = clip.inPoint + local * clip.speed;
  if (clip.reverse) {
    return Math.max(clip.inPoint, clip.inPoint + clip.duration * clip.speed - local * clip.speed);
  }
  return raw;
}

export function clipAt(track: Track, time: number): Clip | null {
  for (const clip of track.clips) {
    if (time >= clip.start && time < clipEnd(clip)) return clip;
  }
  return null;
}

export function clipsAt(track: Track, time: number): Clip[] {
  return track.clips.filter((clip) => time >= clip.start && time < clipEnd(clip));
}

export function clipProgress(clip: Clip, time: number): number {
  return Math.max(0, Math.min(1, (time - clip.start) / Math.max(0.001, clip.duration)));
}

/** Fade ve geçişler için klibin o anki ses/görüntü çarpanı. */
export function clipGain(clip: Clip, time: number): number {
  const local = time - clip.start;
  if (local < 0 || local > clip.duration) return 0;
  let gain = 1;
  if (clip.fadeIn > 0 && local < clip.fadeIn) gain *= local / clip.fadeIn;
  const remaining = clip.duration - local;
  if (clip.fadeOut > 0 && remaining < clip.fadeOut) gain *= remaining / clip.fadeOut;
  return Math.max(0, Math.min(1, gain));
}
