import type { Kind } from "@/lib/files";
import type { Entry } from "@/lib/library";
import { baseClip } from "./core/model";
import type { Clip, ClipKind } from "./core/model";

/**
 * Editör tip ve yardımcılarının uygulama tarafındaki yüzü.
 * Saf model src/editor/core/model.ts içinde; burada yalnızca kitaplık
 * girdisine bağlı klip üretimi gibi UI yardımcıları kalır.
 */
export * from "./core/model";

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

export function durationKind(kind: Kind): "video" | "audio" | "image" | "other" {
  return kind;
}

