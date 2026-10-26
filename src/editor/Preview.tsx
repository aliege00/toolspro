import { useEffect, useMemo, useRef } from "react";
import { Pause, Play } from "@/components/Icons";
import { formatDuration } from "@/lib/files";
import type { Entry } from "@/lib/library";
import type { Clip, Project } from "./types";
import {
  ASPECTS,
  audioTracks,
  clipEnd,
  mainVideoTrack,
  overlayTracks,
  projectDuration,
  textTracks,
} from "./types";
import { clipGain, clipsAt, resolveEntry, sourceTime } from "./media";
import { useEditorT } from "./labels";

function aspectRatio(project: Project): number {
  const found = ASPECTS.find((aspect) => aspect.id === project.aspect);
  if (!found) return 9 / 16;
  return found.ratio
    .split("/")
    .map((part) => Number(part.trim()))
    .reduce((a, b) => a / b);
}

function filterStyle(clip: Clip): string {
  const { brightness, contrast, saturation, preset } = clip.filter;
  const parts = [
    `brightness(${Math.max(0.1, 1 + brightness / 100)})`,
    `contrast(${Math.max(0.1, 1 + contrast / 100)})`,
    `saturate(${Math.max(0, 1 + saturation / 100)})`,
  ];
  if (preset === "bw") parts.push("grayscale(1)");
  if (preset === "sepia") parts.push("sepia(0.85)");
  return parts.join(" ");
}

function transformStyle(clip: Clip, extraScale = 1): string {
  const parts = [`rotate(${clip.rotate}deg)`];
  if (clip.flipH) parts.push("scaleX(-1)");
  if (clip.flipV) parts.push("scaleY(-1)");
  if (extraScale !== 1) parts.push(`scale(${extraScale})`);
  return parts.join(" ");
}

function kenBurnsTransform(clip: Clip, time: number): string {
  if (!clip.kenBurns || clip.kind !== "image") return transformStyle(clip);
  const progress = Math.max(0, Math.min(1, (time - clip.start) / Math.max(0.01, clip.duration)));
  const scale = 1.06 + progress * 0.08;
  const x = (progress - 0.5) * 3.5;
  const y = (progress - 0.5) * 2.5;
  return `${transformStyle(clip)} translate(${x}%, ${y}%) scale(${scale})`;
}

function transitionState(clip: Clip | null, time: number) {
  if (!clip || clip.transitionIn === "none" || clip.transitionDuration <= 0) {
    return { opacity: 1, transform: "none" };
  }
  const local = Math.max(0, time - clip.start);
  const progress = Math.min(1, local / clip.transitionDuration);
  if (clip.transitionIn === "fade") {
    return { opacity: progress, transform: "none" };
  }
  if (clip.transitionIn === "slide") {
    return {
      opacity: 1,
      transform: `translateX(${(1 - progress) * 24}%)`,
    };
  }
  return {
    opacity: 1,
    transform: `scale(${1.12 - progress * 0.12})`,
  };
}

function textAnimation(clip: Clip, time: number) {
  const text = clip.text;
  if (!text) return { opacity: 1, transform: "none" };
  const local = Math.max(0, time - clip.start);
  const remaining = Math.max(0, clipEnd(clip) - time);
  const windowSeconds = 0.35;
  const inProgress = Math.min(1, local / windowSeconds);
  const outProgress = Math.min(1, remaining / windowSeconds);
  let opacity = 1;
  let y = 0;
  let scale = 1;
  if (text.animIn === "fade") opacity *= inProgress;
  if (text.animOut === "fade") opacity *= outProgress;
  if (text.animIn === "slide") y += (1 - inProgress) * 18;
  if (text.animOut === "slide") y -= (1 - outProgress) * 12;
  if (text.animIn === "zoom") scale *= 0.9 + inProgress * 0.1;
  if (text.animOut === "zoom") scale *= 0.94 + outProgress * 0.06;
  return {
    opacity: Math.max(0, Math.min(1, opacity)),
    transform: `translateY(${y}px) scale(${scale})`,
  };
}

function AudioLayer({
  clip,
  entry,
  playhead,
  playing,
  muted,
}: {
  clip: Clip;
  entry: Entry;
  playhead: number;
  playing: boolean;
  muted: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!element.src) element.src = entry.url;
    const target = sourceTime(clip, playhead);
    if (Math.abs(element.currentTime - target) > 0.3) element.currentTime = target;
    element.volume = muted
      ? 0
      : Math.max(0, Math.min(1, clip.volume * clipGain(clip, playhead)));
    if (playing) void element.play().catch(() => undefined);
    else element.pause();
  }, [clip, entry.url, playhead, playing, muted]);

  return <audio ref={ref} preload="auto" className="hidden" />;
}

function OverlayLayer({
  clip,
  entry,
  playhead,
  playing,
}: {
  clip: Clip;
  entry: Entry;
  playhead: number;
  playing: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (element.src !== entry.url) {
      element.src = entry.url;
      element.load();
    }
    const target = sourceTime(clip, playhead);
    if (Math.abs(element.currentTime - target) > 0.3) {
      try {
        element.currentTime = Math.max(0, target);
      } catch {
        /* metadata henüz hazır değil */
      }
    }
    element.playbackRate = Math.max(0.25, Math.min(4, clip.speed));
    element.muted = true;
    if (playing) void element.play().catch(() => undefined);
    else element.pause();
  }, [clip, entry.url, playhead, playing]);

  return (
    <video
      ref={ref}
      playsInline
      className="h-full w-full object-cover"
      style={{ filter: filterStyle(clip), transform: transformStyle(clip) }}
    />
  );
}

export default function Preview({
  project,
  entries,
  playhead,
  playing,
  selectedClipId,
  onTogglePlay,
}: {
  project: Project;
  entries: Entry[];
  playhead: number;
  playing: boolean;
  selectedClipId: string | null;
  onTogglePlay: () => void;
}) {
  const t = useEditorT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mainTrack = mainVideoTrack(project);
  const active = useMemo(
    () => (mainTrack ? clipsAt(mainTrack, playhead)[0] ?? null : null),
    [mainTrack, playhead],
  );
  const activeEntry = active ? resolveEntry(active, entries) : undefined;
  const activeImage = active?.kind === "image" && activeEntry;
  const ratio = aspectRatio(project);

  const activeTexts = useMemo(
    () =>
      textTracks(project).flatMap((track) =>
        clipsAt(track, playhead).map((clip) => ({ clip, track })),
      ),
    [project, playhead],
  );

  const activeOverlays = useMemo(
    () =>
      overlayTracks(project).flatMap((track) =>
        clipsAt(track, playhead)
          .map((clip) => ({ clip, track, entry: resolveEntry(clip, entries) }))
          .filter((item) => !!item.entry),
      ),
    [project, entries, playhead],
  );

  const activeAudio = useMemo(
    () =>
      audioTracks(project).flatMap((track) =>
        clipsAt(track, playhead)
          .map((clip) => ({ clip, track, entry: resolveEntry(clip, entries) }))
          .filter((item) => !!item.entry),
      ),
    [project, entries, playhead],
  );

  const transition = transitionState(active, playhead);
  const fadeGain = active ? clipGain(active, playhead) : 1;

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !active) return;
    element.volume = Math.max(0, Math.min(1, active.volume * clipGain(active, playhead)));
  }, [active, playhead]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !active || !activeEntry || active.kind !== "video") return;
    if (element.src !== activeEntry.url) {
      element.src = activeEntry.url;
      element.load();
    }
    const frozen = active.freezeAt !== undefined;
    const target = frozen ? active.freezeAt! : sourceTime(active, playhead);
    if (Math.abs(element.currentTime - target) > 0.25) {
      try {
        element.currentTime = Math.max(0, target);
      } catch {
        /* metadata henüz hazır değil */
      }
    }
    element.playbackRate = frozen ? 1 : Math.max(0.25, Math.min(4, active.speed));
    element.volume = active.volume;
    element.muted = active.volume <= 0 || !playing;
    if (playing && !frozen) void element.play().catch(() => undefined);
    else element.pause();
    // playhead yalnızca klip değiştiğinde konumlandırılır; oynarken sürekli arama yapılmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, activeEntry?.url, active?.speed, active?.volume, active?.freezeAt, playing]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || playing || !active || active.kind !== "video") return;
    const target = active.freezeAt ?? sourceTime(active, playhead);
    if (Number.isFinite(target) && Math.abs(element.currentTime - target) > 0.25) {
      try {
        element.currentTime = Math.max(0, target);
      } catch {
        /* metadata henüz yüklenmedi */
      }
    }
  }, [playhead, playing, active]);

  const previewWidth = `min(100%, calc(38vh * ${ratio}))`;

  return (
    <div className="px-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11.5px] font-medium tracking-wide text-ink3 uppercase">
          {t("preview")}
        </span>
        <span className="text-[11px] text-ink3">{project.aspect}</span>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-[14px] bg-black"
        style={{
          width: previewWidth,
          aspectRatio: project.aspect.replace(":", " / "),
          containerType: "inline-size",
        }}
        onClick={onTogglePlay}
      >
        <div
          className="absolute inset-0"
          style={{
            opacity: transition.opacity * (active?.kind === "text" ? 1 : fadeGain),
            transform: transition.transform,
          }}
        >
          {active && active.kind === "video" && activeEntry ? (
            <video
              key={active.id}
              ref={videoRef}
              src={activeEntry.url}
              playsInline
              className="h-full w-full object-contain"
              style={{
                filter: filterStyle(active),
                transform: transformStyle(active),
              }}
              onCanPlay={(event) => {
                if (playing && active.freezeAt === undefined) {
                  void event.currentTarget.play().catch(() => undefined);
                }
              }}
            />
          ) : activeImage ? (
            <img
              src={activeImage.url}
              alt=""
              className="h-full w-full object-contain"
              style={{
                filter: filterStyle(active!),
                transform: kenBurnsTransform(active!, playhead),
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-[12px] text-white/30">
                {active && !activeEntry ? t("sourceMissing") : ""}
              </span>
            </div>
          )}
        </div>

        {active?.filter.preset === "vignette" && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,0.72) 100%)",
            }}
          />
        )}

        {activeOverlays.map(({ clip, entry }) => (
          <div
            key={clip.id}
            className="pointer-events-none absolute overflow-hidden rounded-[6px]"
            style={{
              width: `${(clip.pip?.scale ?? 0.35) * 100}%`,
              height: `${(clip.pip?.scale ?? 0.35) * 100}%`,
              left: `${(clip.pip?.x ?? 0.6) * 100}%`,
              top: `${(clip.pip?.y ?? 0.08) * 100}%`,
            }}
          >
            {clip.kind === "image" ? (
              <img
                src={entry!.url}
                alt=""
                className="h-full w-full object-cover"
                style={{ filter: filterStyle(clip) }}
              />
            ) : (
              <OverlayLayer
                clip={clip}
                entry={entry!}
                playhead={playhead}
                playing={playing}
              />
            )}
          </div>
        ))}

        {activeTexts.map(({ clip }) => {
          const text = clip.text;
          if (!text) return null;
          const animation = textAnimation(clip, playhead);
          const justify =
            text.align === "left"
              ? "flex-start"
              : text.align === "right"
                ? "flex-end"
                : "center";
          return (
            <div
              key={clip.id}
              className="pointer-events-none absolute inset-0 flex px-[6%] py-[8%]"
              style={{
                alignItems: "center",
                justifyContent: justify,
                opacity: animation.opacity,
                transform: animation.transform,
              }}
            >
              <span
                style={{
                  color: text.color,
                  fontFamily:
                    text.font === "serif"
                      ? "Georgia, 'Times New Roman', serif"
                      : text.font === "mono"
                        ? "ui-monospace, SFMono-Regular, Menlo, monospace"
                        : "inherit",
                  fontSize: `${(text.size / 1080) * 100}cqw`,
                  fontWeight: 600,
                  lineHeight: 1.18,
                  textAlign: text.align,
                  whiteSpace: "pre-wrap",
                  textShadow: "0 2px 14px rgba(0,0,0,0.35)",
                }}
              >
                {text.content}
              </span>
            </div>
          );
        })}

        {active?.reverse && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[9.5px] text-white/80">
            {t("reverseBadge")}
          </span>
        )}

        {!playing && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
              <Play size={20} />
            </span>
          </span>
        )}

        {activeAudio.map(({ clip, track, entry }) => (
          <AudioLayer
            key={clip.id}
            clip={clip}
            entry={entry!}
            playhead={playhead}
            playing={playing}
            muted={track.muted}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePlay();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-ink active:opacity-70"
          aria-label={playing ? t("pause") : t("play")}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <div className="text-[12px] text-ink2">
          <span className="font-medium text-ink">{formatDuration(playhead)}</span>
          <span className="text-ink3"> / {formatDuration(projectDuration(project))}</span>
        </div>
        <span className="w-10 text-right text-[11px] text-ink3">
          {selectedClipId ? "" : "—"}
        </span>
      </div>
    </div>
  );
}
