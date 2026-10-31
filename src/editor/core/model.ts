/**
 * Editörün saf (React'siz) proje modeli.
 * Bu dosya yalnızca TypeScript/JavaScript çalışma zamanı kullanır; DOM, React
 * veya Capacitor'a bağlı değildir. Birim testleri doğrudan buradan beslenir.
 */

export const CURRENT_SCHEMA = 2;
export const FPS = 30;

export type AspectId = "9:16" | "16:9" | "1:1" | "4:5";
export type TrackKind = "video" | "overlay" | "audio" | "text";
export type ClipKind = "video" | "image" | "audio" | "text";
export type TransitionId = "none" | "fade" | "slide" | "zoom" | "blur" | "flash";
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

export type TextVAlign = "top" | "center" | "bottom";

export type ClipText = {
  content: string;
  font: string;
  size: number;
  color: string;
  align: TextAlign;
  /** Dikey konum. Eski projelerde yok; yokken orta kabul edilir. */
  vAlign?: TextVAlign;
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
  schema: typeof CURRENT_SCHEMA;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  aspect: AspectId;
  fps: number;
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

/**
 * Boşluk davranışı: ana video izinde klip olmayan süre siyah ekran, ses
 * izinde ise sessizlik olarak dışa aktarılır. Klipler birbirine otomatik
 * yapıştırılmaz; kullanıcı taşımadıkça boşluk korunur.
 */
export const GAP_BEHAVIOR = "black-video-and-silence" as const;

export const DEFAULT_FILTER: ClipFilter = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  preset: "none",
};

export const DEFAULT_TRANSITION = 0.4;

let idCounter = 0;

export function newId(prefix = "id"): string {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${random}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  return [...track.clips].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
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

export function aspectSize(
  aspect: AspectId,
  quality: ExportQuality,
): { width: number; height: number } {
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

export function createTrack(kind: TrackKind, index: number): Track {
  const names: Record<TrackKind, string> = {
    video: "Video",
    overlay: `Katman ${index}`,
    audio: "Ses",
    text: "Metin",
  };
  return {
    id: newId("track"),
    kind,
    name: names[kind],
    clips: [],
    muted: false,
  };
}

export function createProject(name: string): Project {
  const now = Date.now();
  return {
    schema: CURRENT_SCHEMA,
    id: newId("project"),
    name: name.trim() || "Yeni proje",
    createdAt: now,
    updatedAt: now,
    aspect: "9:16",
    fps: FPS,
    tracks: [createTrack("video", 1), createTrack("audio", 1), createTrack("text", 1)],
  };
}

export function baseClip(kind: ClipKind, start: number, duration: number): Clip {
  return {
    id: newId("clip"),
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
    id: newId("clip"),
    start: Math.max(0, start),
    filter: { ...clip.filter },
    text: clip.text ? { ...clip.text } : undefined,
    pip: clip.pip ? { ...clip.pip } : undefined,
  };
}

/** Zaman çizelgesinde çakışmayı önlemek için klibi en yakın boşluğa iter. */
export function freeStart(
  track: Track,
  desired: number,
  duration: number,
  ignoreId?: string,
): number {
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

export class ProjectParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectParseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

const TRACK_KINDS: TrackKind[] = ["video", "overlay", "audio", "text"];
const CLIP_KINDS: ClipKind[] = ["video", "image", "audio", "text"];
const TRANSITIONS: TransitionId[] = ["none", "fade", "slide", "zoom", "blur", "flash"];
const PRESETS: FilterPreset[] = ["none", "bw", "sepia", "vignette"];
const ALIGNS: TextAlign[] = ["left", "center", "right"];
const ANIMS: TextAnim[] = ["none", "fade", "slide", "zoom"];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeText(value: unknown): ClipText | undefined {
  if (!isRecord(value)) return undefined;
  return {
    content: stringOr(value.content, "Metin"),
    font: stringOr(value.font, "system"),
    size: clamp(numberOr(value.size, 42), 8, 240),
    color: stringOr(value.color, "#ffffff"),
    align: pick(value.align, ALIGNS, "center"),
    animIn: pick(value.animIn, ANIMS, "fade"),
    animOut: pick(value.animOut, ANIMS, "fade"),
  };
}

function normalizeClip(value: unknown): Clip | null {
  if (!isRecord(value)) return null;
  const kind = pick(value.kind, CLIP_KINDS, "video");
  const duration = Math.max(0.1, numberOr(value.duration, 1));
  const fallback = baseClip(kind, numberOr(value.start, 0), duration);
  const text = normalizeText(value.text);
  const filter = isRecord(value.filter) ? value.filter : {};
  const pipRaw = isRecord(value.pip) ? value.pip : null;
  return {
    ...fallback,
    id: stringOr(value.id, fallback.id),
    name: stringOr(value.name, fallback.name),
    entryId: typeof value.entryId === "string" ? value.entryId : undefined,
    entryKey: typeof value.entryKey === "string" ? value.entryKey : undefined,
    assetPath: typeof value.assetPath === "string" ? value.assetPath : undefined,
    sourceType: typeof value.sourceType === "string" ? value.sourceType : undefined,
    start: Math.max(0, numberOr(value.start, fallback.start)),
    duration,
    inPoint: Math.max(0, numberOr(value.inPoint, 0)),
    sourceDuration: Math.max(
      0.1,
      numberOr(value.sourceDuration, duration * clamp(numberOr(value.speed, 1), SPEED_MIN, SPEED_MAX)),
    ),
    speed: clamp(numberOr(value.speed, 1), SPEED_MIN, SPEED_MAX),
    reverse: boolOr(value.reverse, false),
    volume: clamp(numberOr(value.volume, fallback.volume), 0, 2),
    fadeIn: Math.max(0, numberOr(value.fadeIn, 0)),
    fadeOut: Math.max(0, numberOr(value.fadeOut, 0)),
    rotate: ([0, 90, 180, 270] as const).includes(value.rotate as 0)
      ? (value.rotate as 0 | 90 | 180 | 270)
      : 0,
    flipH: boolOr(value.flipH, false),
    flipV: boolOr(value.flipV, false),
    filter: {
      brightness: clamp(numberOr(filter.brightness, 0), -100, 100),
      contrast: clamp(numberOr(filter.contrast, 0), -100, 100),
      saturation: clamp(numberOr(filter.saturation, 0), -100, 100),
      preset: pick(filter.preset, PRESETS, "none"),
    },
    transitionIn: pick(value.transitionIn, TRANSITIONS, "none"),
    transitionDuration: clamp(numberOr(value.transitionDuration, DEFAULT_TRANSITION), 0.1, 5),
    text: kind === "text" ? (text ?? normalizeText(undefined)) : text,
    freezeAt:
      typeof value.freezeAt === "number" && Number.isFinite(value.freezeAt)
        ? Math.max(0, value.freezeAt)
        : undefined,
    kenBurns: boolOr(value.kenBurns, false),
    pip: pipRaw
      ? {
          scale: clamp(numberOr(pipRaw.scale, 0.4), 0.1, 1),
          x: clamp(numberOr(pipRaw.x, 0.7), 0, 1),
          y: clamp(numberOr(pipRaw.y, 0.7), 0, 1),
        }
      : undefined,
  };
}

function normalizeTrack(value: unknown, index: number): Track {
  const record = isRecord(value) ? value : {};
  const kind = pick(record.kind, TRACK_KINDS, index === 0 ? "video" : "audio");
  const clips = Array.isArray(record.clips)
    ? record.clips
        .map(normalizeClip)
        .filter((clip): clip is Clip => !!clip)
    : [];
  const name = stringOr(record.name, createTrack(kind, index + 1).name);
  return {
    id: stringOr(record.id, newId("track")),
    kind,
    name,
    muted: boolOr(record.muted, false),
    clips: clips.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)),
  };
}

export type MigrationResult = {
  project: Project;
  /** 0 = güncel değil/eksik sürüm, 1 = eski şema, 2 = güncel. */
  from: number;
  warnings: string[];
};

/**
 * Diskteki herhangi bir JSON'u güncel projeye çevirir.
 * Bozuk JSON'da ProjectParseError fırlatır; eksik alanları varsayılanla doldurur.
 */
export function migrateProject(input: unknown): MigrationResult {
  let raw: unknown = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      throw new ProjectParseError("Proje JSON'u okunamadı.");
    }
  }
  if (!isRecord(raw)) throw new ProjectParseError("Proje bir nesne değil.");

  const warnings: string[] = [];
  const rawSchema = numberOr(raw.schema, numberOr(raw.version, 0));
  const from = Math.min(2, Math.max(0, Math.floor(rawSchema)));

  let trackSource: unknown[] = Array.isArray(raw.tracks) ? raw.tracks : [];
  if (Array.isArray(raw.clips) && !Array.isArray(raw.tracks)) {
    // Çok eski / düz liste biçimi: klipleri tek video izine koy.
    trackSource = [{ kind: "video", name: "Video", clips: raw.clips }];
    warnings.push("Düz klip listesi video izine taşındı.");
  }
  if (!Array.isArray(trackSource) || trackSource.length === 0) {
    trackSource = [
      { kind: "video", name: "Video" },
      { kind: "audio", name: "Ses" },
      { kind: "text", name: "Metin" },
    ];
    if (raw.tracks !== undefined) warnings.push("İz listesi eksikti; varsayılan izler eklendi.");
  }

  const tracks = trackSource.map((track, index) => normalizeTrack(track, index));
  const duration = tracks.reduce((end, track) => Math.max(end, trackEnd(track)), 0);
  if (duration > 24 * 60 * 60) warnings.push("Proje 24 saatten uzun; dışa aktarma belleği aşabilir.");

  const now = Date.now();
  const project: Project = {
    schema: CURRENT_SCHEMA,
    id: stringOr(raw.id, newId("project")),
    name: stringOr(raw.name, "Proje"),
    createdAt: numberOr(raw.createdAt, now),
    updatedAt: numberOr(raw.updatedAt, now),
    aspect: pick(raw.aspect, ASPECTS.map((item) => item.id), "9:16"),
    fps: clamp(numberOr(raw.fps, FPS), 1, 60),
    tracks,
  };

  return { project, from, warnings };
}
