import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FlipHIcon,
  MusicIcon,
  TextIcon,
  VideoIcon,
  VolumeIcon,
} from "@/components/Icons";
import { formatDuration } from "@/lib/files";
import { useEditorT } from "./labels";
import type { Clip, Project, Track, TrackKind } from "./types";
import { clipEnd, sortedClips } from "./types";

type TrimEdge = "left" | "right";

type DragState = {
  clipId: string;
  trackId: string;
  mode: "move" | TrimEdge;
  startX: number;
  delta: number;
};

const ROW_HEIGHT: Record<TrackKind, number> = {
  video: 64,
  overlay: 52,
  audio: 46,
  text: 40,
};

const RULER_HEIGHT = 26;
const MIN_PPS = 14;
const MAX_PPS = 220;

function trackIcon(kind: TrackKind) {
  if (kind === "audio") return <MusicIcon size={14} />;
  if (kind === "text") return <TextIcon size={14} />;
  if (kind === "overlay") return <FlipHIcon size={14} />;
  return <VideoIcon size={14} />;
}

function tickStep(pps: number): number {
  if (pps >= 90) return 1;
  if (pps >= 50) return 2;
  if (pps >= 28) return 5;
  return 10;
}

function clipLabel(clip: Clip): string {
  if (clip.kind === "text") return clip.text?.content?.trim() || clip.name;
  return clip.name;
}

function AudioBars() {
  return (
    <div className="flex h-4 items-end gap-[2px] opacity-60">
      {[3, 7, 11, 6, 13, 9, 5, 12, 8, 4, 10, 6].map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="w-[2px] rounded-full bg-current"
          style={{ height }}
        />
      ))}
    </div>
  );
}

export default function Timeline({
  project,
  playhead,
  playing,
  selectedClipId,
  onSelect,
  onSeek,
  onMoveClip,
  onTrimClip,
  onToggleMute,
}: {
  project: Project;
  playhead: number;
  playing: boolean;
  selectedClipId: string | null;
  onSelect: (clipId: string | null, trackId: string) => void;
  onSeek: (time: number) => void;
  onMoveClip: (clipId: string, start: number) => void;
  onTrimClip: (clipId: string, edge: TrimEdge, delta: number) => void;
  onToggleMute: (trackId: string) => void;
}) {
  const t = useEditorT();
  const [pps, setPps] = useState(46);
  const [drag, setDrag] = useState<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());
  const pinchRef = useRef<{ distance: number; pps: number } | null>(null);
  const scrubbing = useRef(false);

  const duration = Math.max(
    1,
    project.tracks.reduce(
      (end, track) =>
        Math.max(end, ...track.clips.map((clip) => clipEnd(clip)), 0),
      0,
    ),
  );
  const contentWidth = Math.max(480, duration * pps + 120);

  useEffect(() => {
    if (!playing) return;
    const element = scrollRef.current;
    if (!element) return;
    const x = playhead * pps;
    const left = element.scrollLeft;
    const right = left + element.clientWidth;
    if (x < left + 30 || x > right - 40) {
      element.scrollLeft = Math.max(0, x - element.clientWidth * 0.3);
    }
  }, [playhead, pps, playing]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2) event.preventDefault();
    };
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => element.removeEventListener("touchmove", onTouchMove);
  }, []);

  const seekFromClientX = (clientX: number) => {
    const element = scrollRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = clientX - rect.left + element.scrollLeft;
    onSeek(Math.max(0, Math.min(duration, x / pps)));
  };

  const handlePinchDown = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch") return;
    pointers.current.set(event.pointerId, event.clientX);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { distance: Math.max(1, Math.abs(a - b)), pps };
      setDrag(null);
    }
  };

  const handlePinchMove = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch" || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, event.clientX);
    if (pointers.current.size !== 2 || !pinchRef.current) return;
    const [a, b] = [...pointers.current.values()];
    const distance = Math.max(1, Math.abs(a - b));
    const next = Math.max(
      MIN_PPS,
      Math.min(MAX_PPS, (pinchRef.current.pps * distance) / pinchRef.current.distance),
    );
    setPps(next);
  };

  const handlePinchUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
  };

  const zoomBy = (factor: number) => {
    setPps((current) => Math.max(MIN_PPS, Math.min(MAX_PPS, current * factor)));
  };

  const beginDrag = (
    event: React.PointerEvent,
    clip: Clip,
    track: Track,
    mode: DragState["mode"],
  ) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (pointers.current.size >= 2) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(clip.id, track.id);
    setDrag({
      clipId: clip.id,
      trackId: track.id,
      mode,
      startX: event.clientX,
      delta: 0,
    });
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!drag) return;
    setDrag((current) =>
      current
        ? { ...current, delta: (event.clientX - current.startX) / pps }
        : current,
    );
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!drag) return;
    const clip = project.tracks
      .find((track) => track.id === drag.trackId)
      ?.clips.find((item) => item.id === drag.clipId);
    const delta = (event.clientX - drag.startX) / pps;
    setDrag(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer zaten bırakılmış olabilir */
    }
    if (!clip || Math.abs(delta) < 0.04) return;
    if (drag.mode === "move") onMoveClip(clip.id, Math.max(0, clip.start + delta));
    else onTrimClip(clip.id, drag.mode, delta);
  };

  const contentHeight =
    RULER_HEIGHT +
    project.tracks.reduce((sum, track) => sum + ROW_HEIGHT[track.kind], 0);

  return (
    <div className="overflow-hidden rounded-[16px] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[11.5px] font-medium tracking-wide text-ink3 uppercase">
          {t("timeline")}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-fill text-[15px] text-ink2 active:opacity-60"
            aria-label={t("zoomOut")}
          >
            −
          </button>
          <span className="w-[38px] text-center text-[11px] text-ink3">
            %{Math.round((pps / 46) * 100)}
          </span>
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-fill text-[15px] text-ink2 active:opacity-60"
            aria-label={t("zoomIn")}
          >
            +
          </button>
        </div>
      </div>

      <div className="flex" style={{ height: contentHeight + 8 }}>
        <div className="w-[70px] shrink-0 border-r border-line bg-card">
          <div style={{ height: RULER_HEIGHT }} className="border-b border-line" />
          {project.tracks.map((track) => (
            <div
              key={track.id}
              style={{ height: ROW_HEIGHT[track.kind] }}
              className="flex items-center gap-1.5 border-b border-line px-2 last:border-b-0"
            >
              <span className="text-ink3">{trackIcon(track.kind)}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink2">
                {track.name}
              </span>
              {track.kind === "audio" && (
                <button
                  type="button"
                  onClick={() => onToggleMute(track.id)}
                  className={`shrink-0 rounded-[6px] p-0.5 ${
                    track.muted ? "text-ink3" : "text-ink2"
                  }`}
                  aria-label="Sesi aç/kapat"
                >
                  <VolumeIcon size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          ref={scrollRef}
          className="no-scrollbar relative flex-1 overflow-x-auto overscroll-x-contain"
          onPointerDownCapture={handlePinchDown}
          onPointerMove={handlePinchMove}
          onPointerUp={handlePinchUp}
          onPointerCancel={handlePinchUp}
        >
          <div style={{ width: contentWidth, minHeight: contentHeight }} className="relative">
            <div
              style={{ height: RULER_HEIGHT }}
              className="relative border-b border-line"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                scrubbing.current = true;
                seekFromClientX(event.clientX);
              }}
              onPointerMove={(event) => {
                if (scrubbing.current) seekFromClientX(event.clientX);
              }}
              onPointerUp={(event) => {
                scrubbing.current = false;
                try {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                } catch {
                  /* yoksay */
                }
              }}
            >
              {Array.from({ length: Math.ceil(contentWidth / (pps * tickStep(pps))) + 1 }).map(
                (_, index) => {
                  const step = tickStep(pps);
                  const seconds = index * step;
                  return (
                    <div
                      key={seconds}
                      className="absolute top-0 bottom-0 border-l border-line/70"
                      style={{ left: seconds * pps }}
                    >
                      <span className="absolute top-1 left-1 text-[9px] text-ink3">
                        {formatDuration(seconds)}
                      </span>
                    </div>
                  );
                },
              )}
            </div>

            {project.tracks.map((track) => (
              <div
                key={track.id}
                style={{ height: ROW_HEIGHT[track.kind] }}
                className="relative border-b border-line/60 last:border-b-0"
                onPointerDown={() => onSelect(null, track.id)}
              >
                <div className="pointer-events-none absolute inset-y-1 inset-x-0 bg-fill/25" />

                {sortedClips(track).map((clip) => {
                  const active = drag?.clipId === clip.id;
                  const delta = active ? drag.delta : 0;
                  let left = clip.start * pps;
                  let width = clip.duration * pps;
                  if (active && drag.mode === "move") left += delta * pps;
                  if (active && drag.mode === "left") {
                    left += delta * pps;
                    width -= delta * pps;
                  }
                  if (active && drag.mode === "right") width += delta * pps;
                  width = Math.max(18, width);
                  left = Math.max(0, left);
                  const selected = selectedClipId === clip.id;
                  const isText = clip.kind === "text";
                  const isAudio = clip.kind === "audio";

                  return (
                    <div
                      key={clip.id}
                      data-clip
                      role="button"
                      tabIndex={0}
                      onPointerDown={(event) => beginDrag(event, clip, track, "move")}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          onSelect(clip.id, track.id);
                        }
                      }}
                      className={`absolute top-1 bottom-1 touch-none overflow-hidden rounded-[8px] border text-left transition-colors ${
                        selected
                          ? "border-ink/70 bg-fill text-ink shadow-[var(--shadow-card)]"
                          : "border-line bg-tile text-tile-ink"
                      }`}
                      style={{ left, width, zIndex: selected ? 5 : 2 }}
                    >
                      <div className="flex h-full flex-col justify-between px-1.5 py-1">
                        <div className="flex min-w-0 items-center gap-1">
                          {isAudio ? (
                            <MusicIcon size={10} />
                          ) : isText ? (
                            <TextIcon size={10} />
                          ) : clip.kind === "image" ? (
                            <FlipHIcon size={10} />
                          ) : (
                            <VideoIcon size={10} />
                          )}
                          <span className="truncate text-[10px] font-medium">
                            {clipLabel(clip)}
                          </span>
                        </div>
                        {isAudio ? (
                          <AudioBars />
                        ) : (
                          <div className="flex items-center justify-between text-[8.5px] opacity-70">
                            <span>{formatDuration(clip.duration)}</span>
                            {clip.speed !== 1 && <span>{clip.speed}x</span>}
                          </div>
                        )}
                      </div>

                      {selected && (
                        <>
                          <button
                            type="button"
                            aria-label={t("trimLeft")}
                            onPointerDown={(event) => beginDrag(event, clip, track, "left")}
                            onPointerMove={moveDrag}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                            className="absolute inset-y-0 left-0 w-2.5 touch-none bg-ink/80"
                          >
                            <span className="absolute top-1/2 left-[3px] h-3 w-[2px] -translate-y-1/2 rounded-full bg-bg" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("trimRight")}
                            onPointerDown={(event) => beginDrag(event, clip, track, "right")}
                            onPointerMove={moveDrag}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                            className="absolute inset-y-0 right-0 w-2.5 touch-none bg-ink/80"
                          >
                            <span className="absolute top-1/2 right-[3px] h-3 w-[2px] -translate-y-1/2 rounded-full bg-bg" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-[1.5px] bg-ink"
              style={{ left: playhead * pps }}
            >
              <span className="absolute -top-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-ink" />
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: playing ? 1 : 0.65 }}
        className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[10.5px] text-ink3"
      >
        <span>{t("trimHint")}</span>
        <span>{formatDuration(playhead)} / {formatDuration(duration)}</span>
      </motion.div>
    </div>
  );
}
