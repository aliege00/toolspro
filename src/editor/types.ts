import { newId } from "@/lib/files";
import type { Kind } from "@/lib/files";
import type { Entry } from "@/lib/library";

export type AspectId = "9:16" | "16:9" | "1:1" | "4:5";
export type TrackKind = "video" | "overlay" | "audio" | "text";
export type ClipKind = "video" | "image" | "audio" | "text";
export type TransitionId = "none" | "fade" | "slide" | "zoom";
export type FilterPreset = "none" | "bw" | "sepia" | "vignette";
export type TextAlign = "left" | "center" | "right";
export type TextAnim = "none" | "fade" | "slide" | "zoom";
export type ExportQuality = 480 | 720 | 1080;

export type ClipFilter = {
  brightness: number;
  contrast: number;
  saturation: number;
  preset: FilterPreset;
};

export type ClipText = {
  content: string;
  font: string;
  size: number;
  color: string;
  align: TextAlign;
  animIn: TextAnim;
  animOut: TextAnim;
};

export type Clip = {
  id: string;
  kind: ClipKind;
  name: string;
  entryId?: string;
  entryKey?: string;
  assetPath?: string;
  sourceType?: string;
  start: number;
  duration: number;
  inPoint: number;
  sourceDuration: number;
  speed: number;
  reverse: boolean;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  filter: ClipFilter;
  transitionIn: TransitionId;
  transitionDuration: number;
  text?: ClipText;
  /** Bu saniyedeki kare donar; süre boyunca sabit kalır. */
  freezeAt?: number;
  kenBurns?: boolean;
  pip?: { scale: number; x: number; y: number };
};

export type Track = {
  id: string;
  kind: TrackKind;
  name: string;
  clips: Clip[];
  muted: boolean;
};

export type Project = {
  schema: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  aspect: AspectId;
  tracks: Track[];
};

export const ASPECTS: { id: AspectId; ratio: string; label: string }[] = [
  { id: "9:16", ratio: "9 / 16", label: "9:16" },
  { id: "16:9", ratio: "16 / 9", label: "16:9" },
  { id: "1:1", ratio: "1 / 1", label: "1:1" },
  { id: "4:5", ratio: "4 / 5", label: "4:5" },
];

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

export const DEFAULT_FILTER: ClipFilter = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  preset: "none",
};

export const DEFAULT_TRANSITION = 0.4;

export function aspectSize(aspect: AspectId, quality: ExportQuality): { width: number; height: number } {
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  switch (aspect) {
    case "16:9":
      return { width: even((quality * 16) / 9), height: quality };
    case "1:1":
      return { width: quality, height: quality };
    case "4:5":
      return { width: quality, height: even((quality * 5) / 4) };
    case "9:16":
    default:
      return { width: quality, height: even((quality * 16) / 9) };
  }
}

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration;
}

export function trackEnd(track: Track): number {
  return track.clips.reduce((end, clip) => Math.max(end, clipEnd(clip)), 0);
}

export function projectDuration(project: Project): number {
  return project.tracks.reduce((end, track) => Math.max(end, trackEnd(track)), 0);
}

export function sortedClips(track: Track): Clip[] {
  return [...track.clips].sort((a, b) => a.start - b.start);
}

export function mainVideoTrack(project: Project): Track | undefined {
  return project.tracks.find((track) => track.kind === "video");
}

export function overlayTracks(project: Project): Track[] {
  return project.tracks.filter((track) => track.kind === "overlay");
}

export function textTracks(project: Project): Track[] {
  return project.tracks.filter((track) => track.kind === "text");
}

export function audioTracks(project: Project): Track[] {
  return project.tracks.filter((track) => track.kind === "audio");
}

export function trackAccepts(kind: TrackKind, clip: ClipKind): boolean {
  if (kind === "audio") return clip === "audio";
  if (kind === "text") return clip === "text";
  return clip === "video" || clip === "image";
}

export function createTrack(kind: TrackKind, index: number): Track {
  const names: Record<TrackKind, string> = {
    video: "Video",
    overlay: `Katman ${index}`,
    audio: "Ses",
    text: "Metin",
  };
  return {
    id: newId(),
    kind,
    name: names[kind],
    clips: [],
    muted: false,
  };
}

export function createProject(name: string): Project {
  const now = Date.now();
  return {
    schema: 1,
    id: newId(),
    name: name.trim() || "Yeni proje",
    createdAt: now,
    updatedAt: now,
    aspect: "9:16",
    tracks: [
      createTrack("video", 1),
      createTrack("audio", 1),
      createTrack("text", 1),
    ],
  };
}

function baseClip(kind: ClipKind, start: number, duration: number): Clip {
  return {
    id: newId(),
    kind,
    name: kind === "text" ? "Metin" : kind === "image" ? "Görsel" : "Klip",
    start: Math.max(0, start),
    duration: Math.max(0.1, duration),
    inPoint: 0,
    sourceDuration: Math.max(0.1, duration),
    speed: 1,
    reverse: false,
    volume: kind === "text" || kind === "image" ? 0 : 1,
    fadeIn: 0,
    fadeOut: 0,
    rotate: 0,
    flipH: false,
    flipV: false,
    filter: { ...DEFAULT_FILTER },
    transitionIn: "none",
    transitionDuration: DEFAULT_TRANSITION,
  };
}

function entryClipKind(entry: Entry): ClipKind {
  if (entry.kind === "video" || entry.kind === "audio" || entry.kind === "image") {
    return entry.kind;
  }
  return "video";
}

export function clipFromEntry(entry: Entry, start: number, duration: number): Clip {
  const kind = entryClipKind(entry);
  const clip = baseClip(kind, start, duration);
  return {
    ...clip,
    kind,
    name: entry.name,
    entryId: entry.id,
    entryKey: entry.key,
    sourceType: entry.file.type,
    sourceDuration: Math.max(0.1, duration),
    volume: kind === "audio" || kind === "video" ? 1 : 0,
  };
}

export function textClip(start: number, duration = 3): Clip {
  const clip = baseClip("text", start, duration);
  return {
    ...clip,
    name: "Metin",
    text: {
      content: "Metin",
      font: "system",
      size: 42,
      color: "#ffffff",
      align: "center",
      animIn: "fade",
      animOut: "fade",
    },
  };
}

export function cloneClip(clip: Clip, start: number): Clip {
  return {
    ...clip,
    id: newId(),
    start: Math.max(0, start),
    filter: { ...clip.filter },
    text: clip.text ? { ...clip.text } : undefined,
    pip: clip.pip ? { ...clip.pip } : undefined,
  };
}

export function durationKind(kind: Kind): "video" | "audio" | "image" | "other" {
  return kind;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Zaman çizelgesinde çakışmayı önlemek için klibi en yakın boşluğa iter. */
export function freeStart(track: Track, desired: number, duration: number, ignoreId?: string): number {
  let start = Math.max(0, desired);
  const others = sortedClips(track).filter((clip) => clip.id !== ignoreId);
  for (const clip of others) {
    const end = clipEnd(clip);
    if (start < end && start + duration > clip.start) {
      start = end;
    }
  }
  return Math.max(0, start);
}
