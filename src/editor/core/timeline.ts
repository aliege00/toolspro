/**
 * Saf zaman çizelgesi işlemleri. Her fonksiyon yeni bir proje döndürür;
 * girdi proje değiştirilmez. Aynı izde klipler çakışmaz.
 */
import {
  SPEED_MAX,
  SPEED_MIN,
  clamp,
  clipEnd,
  newId,
  sortedClips,
  trackEnd,
} from "./model";
import type { Clip, Project, Track } from "./model";

export const MIN_CLIP = 0.2;

function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

function findClip(project: Project, clipId: string): { track: Track; clip: Clip } | null {
  for (const track of project.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

/** Bir izdeki klipleri sırayla iter; çakışan sonraki klibi öne doğru kaydırır. */
export function resolveOverlaps(track: Track): Track {
  const ordered = sortedClips(track);
  let cursor = 0;
  for (const clip of ordered) {
    if (clip.start < cursor) {
      clip.start = cursor;
    }
    cursor = clipEnd(clip);
  }
  return { ...track, clips: ordered };
}

export function normalizeTrack(track: Track): Track {
  return resolveOverlaps(track);
}

export function normalizeProject(project: Project): Project {
  const next = cloneProject(project);
  next.tracks = next.tracks.map(resolveOverlaps);
  return next;
}

function withClip(
  project: Project,
  clipId: string,
  update: (clip: Clip, track: Track) => void,
  pin = false,
): Project {
  const next = cloneProject(project);
  for (const track of next.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (!clip) continue;
    update(clip, track);
    if (!pin) track.clips = sortedClips(track);
  }
  return pin ? next : normalizeProject(next);
}

/** Kaynaktan kullanılabilir süre (klip hızından bağımsız, kaynak saniyesi). */
export function sourceSpan(clip: Clip): number {
  if (clip.kind !== "video" && clip.kind !== "audio") return clip.duration;
  return Math.max(
    0.05,
    Math.min(clip.duration * clip.speed, Math.max(0.05, clip.sourceDuration - clip.inPoint)),
  );
}

export function splitClip(
  project: Project,
  clipId: string,
  time: number,
): { project: Project; rightId: string | null } {
  const found = findClip(project, clipId);
  if (!found) return { project, rightId: null };
  const { clip } = found;
  if (time <= clip.start + 0.08 || time >= clipEnd(clip) - 0.08) {
    return { project, rightId: null };
  }

  const leftDuration = time - clip.start;
  const rightDuration = clip.duration - leftDuration;
  const right: Clip = {
    ...clip,
    id: newId("clip"),
    start: time,
    duration: rightDuration,
    inPoint:
      clip.kind === "video" || clip.kind === "audio"
        ? clip.inPoint + leftDuration * clip.speed
        : clip.inPoint,
    filter: { ...clip.filter },
    text: clip.text ? { ...clip.text } : undefined,
    pip: clip.pip ? { ...clip.pip } : undefined,
  };

  const next = cloneProject(project);
  const track = next.tracks.find((item) => item.id === found.track.id);
  if (!track) return { project, rightId: null };
  const target = track.clips.find((item) => item.id === clipId);
  if (!target) return { project, rightId: null };
  target.duration = leftDuration;
  track.clips.push(right);
  track.clips = sortedClips(track);
  return { project: normalizeProject(next), rightId: right.id };
}

export function deleteClip(project: Project, clipId: string): Project {
  const next = cloneProject(project);
  for (const track of next.tracks) {
    const filtered = track.clips.filter((clip) => clip.id !== clipId);
    if (filtered.length !== track.clips.length) {
      track.clips = filtered;
    }
  }
  return next;
}

export function duplicateClip(
  project: Project,
  clipId: string,
): { project: Project; clipId: string | null } {
  const found = findClip(project, clipId);
  if (!found) return { project, clipId: null };
  const next = cloneProject(project);
  const track = next.tracks.find((item) => item.id === found.track.id);
  if (!track) return { project, clipId: null };
  const original = track.clips.find((item) => item.id === clipId);
  if (!original) return { project, clipId: null };
  const copy: Clip = {
    ...original,
    id: newId("clip"),
    filter: { ...original.filter },
    text: original.text ? { ...original.text } : undefined,
    pip: original.pip ? { ...original.pip } : undefined,
  };
  // Özgün klibin hemen sağındaki ilk boşluğa yerleştir.
  let start = clipEnd(original);
  for (const other of sortedClips(track)) {
    if (other.id === original.id) continue;
    if (start < clipEnd(other) && start + copy.duration > other.start) {
      start = clipEnd(other);
    }
  }
  copy.start = Math.max(0, start);
  track.clips = sortedClips({ ...track, clips: [...track.clips, copy] });
  return { project: normalizeProject(next), clipId: copy.id };
}

/**
 * Klibi istenen ana taşır. Çakışma varsa sonraki klipler sağa itilir;
 * böylece aynı izde iki klip asla üst üste binmez.
 */
export function moveClip(project: Project, clipId: string, desiredStart: number): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const next = cloneProject(project);
  const track = next.tracks.find((item) => item.id === found.track.id);
  if (!track) return project;
  const clip = track.clips.find((item) => item.id === clipId);
  if (!clip) return project;
  clip.start = Math.max(0, desiredStart);
  track.clips = sortedClips(track);
  return normalizeProject(next);
}

/** Kenardan kırpma. Sol kenar kaynağı da kaydırır; sağ kenar süreyi kısaltır. */
export function trimClip(
  project: Project,
  clipId: string,
  edge: "left" | "right",
  delta: number,
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const { clip, track } = found;
  const others = sortedClips(track).filter((item) => item.id !== clipId);
  const previous = [...others].reverse().find((item) => clipEnd(item) <= clip.start + 0.001);
  const nextClip = others.find((item) => item.start >= clipEnd(clip) - 0.001);
  const isMedia = clip.kind === "video" || clip.kind === "audio";

  if (edge === "left") {
    const sourceLimit = isMedia
      ? clip.start - clip.inPoint / Math.max(0.01, clip.speed)
      : 0;
    const minStart = Math.max(0, sourceLimit, previous ? clipEnd(previous) : 0);
    const maxStart = clipEnd(clip) - MIN_CLIP;
    const newStart = clamp(clip.start + delta, minStart, maxStart);
    const shift = newStart - clip.start;
    const newDuration = clip.duration - shift;
    return withClip(project, clipId, (target) => {
      target.start = newStart;
      target.duration = newDuration;
      if (isMedia) {
        const maxIn = Math.max(0, target.sourceDuration - newDuration * target.speed);
        target.inPoint = clamp(target.inPoint + shift * target.speed, 0, maxIn);
      }
    });
  }

  const sourceMax = isMedia
    ? Math.max(MIN_CLIP, (clip.sourceDuration - clip.inPoint) / Math.max(0.01, clip.speed))
    : Number.POSITIVE_INFINITY;
  const nextLimit = nextClip ? nextClip.start - clip.start : Number.POSITIVE_INFINITY;
  const maxDuration = Math.min(sourceMax, nextLimit);
  const newDuration = clamp(clip.duration + delta, MIN_CLIP, maxDuration);
  return withClip(project, clipId, (target) => {
    target.duration = newDuration;
  });
}

/** Hız değişince süre kaynak süresine göre otomatik yeniden hesaplanır. */
export function setClipSpeed(project: Project, clipId: string, speed: number): Project {
  const value = clamp(speed, SPEED_MIN, SPEED_MAX);
  return withClip(project, clipId, (clip) => {
    if (clip.kind !== "video" && clip.kind !== "audio") return;
    const span = sourceSpan(clip);
    clip.speed = value;
    clip.duration = Math.max(MIN_CLIP, span / value);
  });
}

export function setClipVolume(project: Project, clipId: string, volume: number): Project {
  return withClip(project, clipId, (clip) => {
    clip.volume = clamp(volume, 0, 2);
  });
}

export function setClipReverse(project: Project, clipId: string, reverse: boolean): Project {
  return withClip(project, clipId, (clip) => {
    clip.reverse = reverse;
  });
}

export function setClipFade(
  project: Project,
  clipId: string,
  edge: "in" | "out",
  seconds: number,
): Project {
  return withClip(project, clipId, (clip) => {
    const value = clamp(seconds, 0, clip.duration / 2);
    if (edge === "in") clip.fadeIn = value;
    else clip.fadeOut = value;
  });
}

/** İzi başlangıç zamanına göre sıralar. */
export function sortTrack(project: Project, trackId: string): Project {
  const next = cloneProject(project);
  const track = next.tracks.find((item) => item.id === trackId);
  if (!track) return project;
  track.clips = sortedClips(track);
  return normalizeProject(next);
}

/** Klipleri boşluksuz, sırayla paketler (siyah/sessiz boşluk kaldırılır). */
export function compactTrack(project: Project, trackId: string): Project {
  const next = cloneProject(project);
  const track = next.tracks.find((item) => item.id === trackId);
  if (!track) return project;
  let cursor = 0;
  for (const clip of sortedClips(track)) {
    clip.start = cursor;
    cursor = clipEnd(clip);
  }
  track.clips = sortedClips(track);
  return next;
}

export function trimTrackToEnd(project: Project, trackId: string): Project {
  const next = cloneProject(project);
  const track = next.tracks.find((item) => item.id === trackId);
  if (!track) return project;
  track.clips = track.clips.filter((clip) => clip.duration >= MIN_CLIP);
  return normalizeProject(next);
}

/** Bir izin toplam süresi; boşluklar dahil. */
export function trackDuration(project: Project, trackId: string): number {
  const track = project.tracks.find((item) => item.id === trackId);
  return track ? trackEnd(track) : 0;
}

export function sortedById(project: Project): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) => ({ ...track, clips: sortedClips(track) })),
  };
}
