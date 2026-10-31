import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, EmptyState, NavBar, Sheet, Slider } from "@/components/ui";
import Thumb from "@/components/Thumb";
import {
  Back10,
  Expand,
  Forward10,
  Moon,
  MusicIcon,
  Pause,
  Play,
  Repeat1Icon,
  RepeatIcon,
  Sun,
  TrashIcon,
  VideoIcon,
} from "@/components/Icons";
import { formatBytes, formatDuration, pickFiles } from "@/lib/files";
import { useLibrary } from "@/lib/library";
import type { Entry } from "@/lib/library";
import { useNav } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { useT } from "@/i18n";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
type RepeatMode = "off" | "all" | "one";
type Cue = { start: number; end: number; text: string };

function posKey(entry: Entry): string {
  return `medya.pos.${entry.file.name}:${entry.size}:${entry.file.lastModified}`;
}

function readPos(entry: Entry): number {
  const value = Number(localStorage.getItem(posKey(entry)) ?? 0);
  return isFinite(value) && value > 0 ? value : 0;
}

function savePos(entry: Entry, time: number): void {
  const key = posKey(entry);
  if (time > 5) localStorage.setItem(key, String(Math.floor(time)));
  else localStorage.removeItem(key);
}

function clearPos(entry: Entry): void {
  localStorage.removeItem(posKey(entry));
}

function srtTimeToSeconds(value: string): number | null {
  const match = value.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return null;
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  );
}

function parseSrt(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    const timeIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeIndex === -1) continue;
    const [startRaw, endRaw] = lines[timeIndex].split("-->");
    const start = srtTimeToSeconds(startRaw ?? "");
    const end = srtTimeToSeconds(endRaw ?? "");
    if (start === null || end === null) continue;
    const text = lines
      .slice(timeIndex + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

export default function VideoScreen({ fileId }: { fileId?: string }) {
  const t = useT();
  const { theme } = useTheme();
  const { pop, push } = useNav();
  const { entries, addFiles, remove, hidden } = useLibrary();

  // Oynatıcı tüm videoları tanır; gizli olanlar da aynı yoldan açılır.
  const allVideos = useMemo(
    () => entries.filter((e) => e.kind === "video"),
    [entries],
  );
  const startVideo = useMemo(
    () => (fileId ? allVideos.find((v) => v.id === fileId) ?? null : null),
    [fileId, allVideos],
  );
  // Sıra listesi, videonun açıldığı klasörün kapsamını korur:
  // gizli klasörden açılan video yalnızca gizli videolar arasında ilerler.
  const startHidden = startVideo ? hidden.includes(startVideo.key) : false;
  const videos = useMemo(
    () => allVideos.filter((e) => hidden.includes(e.key) === startHidden),
    [allVideos, hidden, startHidden],
  );

  const [currentId, setCurrentId] = useState<string | null>(fileId ?? null);
  const current = useMemo(() => {
    if (currentId) {
      const found = videos.find((v) => v.id === currentId);
      if (found) return found;
    }
    return startVideo ?? videos[0] ?? null;
  }, [currentId, videos, startVideo]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const lastSave = useRef(0);
  const lastTap = useRef<{ time: number; side: "l" | "r" }>({ time: 0, side: "l" });
  const hudTimer = useRef<number | undefined>(undefined);
  const gesture = useRef<{
    mode: "none" | "left" | "right";
    startY: number;
    startValue: number;
    moved: boolean;
  }>({ mode: "none", startY: 0, startValue: 0, moved: false });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [brightness, setBrightness] = useState(1);
  const [volume, setVolume] = useState(1);
  const [hud, setHud] = useState<{ type: "volume" | "brightness"; value: number } | null>(null);

  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [resumeHint, setResumeHint] = useState<number | null>(null);
  const [flyLabel, setFlyLabel] = useState<{ side: "l" | "r"; id: number } | null>(null);

  const [cues, setCues] = useState<Cue[] | null>(null);
  const [subtitleName, setSubtitleName] = useState<string | null>(null);
  const [subDelay, setSubDelay] = useState(0);
  const [cueText, setCueText] = useState<string | null>(null);
  const [subtitleSheet, setSubtitleSheet] = useState(false);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);

  const poke = useCallback(() => {
    setShowControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 3200);
  }, []);

  const hideControls = useCallback(() => {
    setShowControls(false);
    window.clearTimeout(hideTimer.current);
  }, []);

  // Yeni video seçilince sıfırla
  useEffect(() => {
    setTime(0);
    setDuration(0);
    setPlaying(false);
    setError(null);
    setSpeed(1);
    setCueText(null);
    setResumeHint(null);
    lastSave.current = 0;
    poke();
  }, [current?.id, poke]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    video.volume = volume;
  }, [speed, volume, current?.id]);

  // Zaman + altyazı aktualizasyonu
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      const video = videoRef.current;
      if (video && Math.abs(video.currentTime - last) > 0.08) {
        last = video.currentTime;
        setTime(last);
        if (video.currentTime - lastSave.current > 5 && current) {
          lastSave.current = video.currentTime;
          savePos(current, video.currentTime);
        }
        if (cues) {
          const effective = last - subDelay;
          const cue = cues.find((c) => effective >= c.start && effective <= c.end);
          setCueText(cue ? cue.text : null);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, cues, subDelay, current]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  // MediaSession: sistem/ekran kilit kontrolleri + arka plan
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      if (current && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: current.name });
      }
      const video = videoRef.current;
      navigator.mediaSession.setActionHandler("play", () => void video?.play());
      navigator.mediaSession.setActionHandler("pause", () => video?.pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        if (video) video.currentTime = Math.max(0, video.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        if (video) video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext(false));
    } catch {
      /* bazı oturumlar tüm eylemleri desteklemez */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
  }, [playing]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || error) return;
    if (video.paused) {
      void video.play().catch(() => setError(t("video.startError")));
    } else {
      video.pause();
    }
    poke();
  };

  const skip = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(
      Math.max(0, video.currentTime + delta),
      video.duration || 0,
    );
    setTime(video.currentTime);
    poke();
  };

  const seekTo = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setTime(value);
    poke();
  };

  const cycleSpeed = () => {
    const index = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
    poke();
  };

  const cycleRepeat = () => {
    setRepeat((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
    poke();
  };

  const playNext = useCallback(
    (auto: boolean) => {
      if (!current || videos.length === 0) return;
      const index = videos.findIndex((v) => v.id === current.id);
      if (index === -1) return;
      savePos(current, 0);
      const next = videos[index + 1];
      if (next) {
        setCurrentId(next.id);
        return;
      }
      if (repeat === "all") {
        setCurrentId(videos[0].id);
        return;
      }
      if (!auto) return;
    },
    [current, videos, repeat],
  );

  const handleEnded = () => {
    setPlaying(false);
    if (current) clearPos(current);
    if (repeat === "one") {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        void video.play();
      }
      return;
    }
    if (repeat === "all" || repeat === "off") {
      const index = videos.findIndex((v) => v.id === current?.id);
      const next = videos[index + 1];
      if (next) setCurrentId(next.id);
      else if (repeat === "all" && videos[0]) setCurrentId(videos[0].id);
    }
  };

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        try {
          await screen.orientation.lock("landscape");
        } catch {
          /* yatay kilidi desteklenmiyor */
        }
      } else {
        try {
          screen.orientation.unlock();
        } catch {
          /* yoksay */
        }
        await document.exitFullscreen();
      }
    } catch {
      /* tam ekran engellendi */
    }
    poke();
  };

  const addVideos = async () => {
    const files = await pickFiles({ multiple: true, accept: "video/*" });
    if (files.length === 0) return;
    const fresh = addFiles(files);
    if (fresh[0]) setCurrentId(fresh[0].id);
  };

  const loadSubtitles = async () => {
    setSubtitleError(null);
    const files = await pickFiles({ accept: ".srt,text/vtt" });
    const file = files[0];
    if (!file) return;
    try {
      const parsed = parseSrt(await file.text());
      if (parsed.length === 0) throw new Error("empty");
      setCues(parsed);
      setSubtitleName(file.name);
      setSubDelay(0);
    } catch {
      setCues(null);
      setSubtitleName(null);
      setSubtitleError(t("video.subtitleError"));
    }
  };

  const clearSubtitles = () => {
    setCues(null);
    setSubtitleName(null);
    setCueText(null);
    setSubDelay(0);
  };

  const showFly = (side: "l" | "r") => {
    setFlyLabel({ side, id: Date.now() });
    window.setTimeout(() => setFlyLabel(null), 500);
  };

  const showHud = (type: "volume" | "brightness", value: number) => {
    setHud({ type, value });
    window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => setHud(null), 900);
  };

  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a")) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    let mode: "none" | "left" | "right" = "none";
    if (e.clientX - rect.left < 30) mode = "left";
    else if (rect.right - e.clientX < 30) mode = "right";
    gesture.current = {
      mode,
      startY: e.clientY,
      startValue: mode === "left" ? brightness : volume,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.mode === "none") return;
    const dy = g.startY - e.clientY;
    if (Math.abs(dy) < 6 && !g.moved) return;
    g.moved = true;
    const ratio = Math.min(1, Math.max(0, g.startValue + dy / 220));
    if (g.mode === "left") {
      const value = Math.min(1, Math.max(0.15, ratio));
      setBrightness(value);
      const video = videoRef.current;
      if (video) video.style.filter = value < 1 ? `brightness(${value})` : "";
      showHud("brightness", value);
    } else {
      const value = Math.min(1, Math.max(0, ratio));
      setVolume(value);
      const video = videoRef.current;
      if (video) video.volume = value;
      showHud("volume", value);
    }
  };

  const onStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g.mode !== "none") {
      gesture.current = { mode: "none", startY: 0, startValue: 0, moved: false };
      if (g.moved) return;
    }

    const target = e.target as HTMLElement;
    if (target.closest("button, input, a")) return;

    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const side: "l" | "r" =
      e.clientX - rect.left < rect.width / 2 ? "l" : "r";
    const now = Date.now();

    if (now - lastTap.current.time < 300 && lastTap.current.side === side) {
      lastTap.current = { time: 0, side };
      showFly(side);
      skip(side === "l" ? -10 : 10);
      return;
    }

    lastTap.current = { time: now, side };
    if (showControls) hideControls();
    else poke();
  };

  // Kaldığı yerden devam: metadata yüklenince konumu geri yükle
  const onLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setDuration(video.duration || 0);
    if (!current) return;
    const saved = readPos(current);
    if (saved > 5 && (!video.duration || saved < video.duration - 5)) {
      video.currentTime = saved;
      setTime(saved);
      setResumeHint(saved);
      window.setTimeout(() => setResumeHint(null), 5000);
    }
  };

  const onPause = () => {
    setPlaying(false);
    setShowControls(true);
    window.clearTimeout(hideTimer.current);
    if (current && videoRef.current) savePos(current, videoRef.current.currentTime);
  };

  const repeatLabel =
    repeat === "off"
      ? t("video.repeatOff")
      : repeat === "all"
        ? t("video.repeatAll")
        : t("video.repeatOne");

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar
        title={t("video.title")}
        subtitle={videos.length > 0 ? String(videos.length) : undefined}
        onBack={pop}
        right={
          <Button size="sm" variant="secondary" onClick={addVideos}>
            {t("video.add")}
          </Button>
        }
      />

      {videos.length === 0 || !current ? (
        <EmptyState
          icon={<VideoIcon size={30} />}
          title={t("video.emptyTitle")}
          description={t("video.emptyDesc")}
        >
          <Button full onClick={addVideos}>
            {t("video.choose")}
          </Button>
        </EmptyState>
      ) : (
        <div className="px-4 pt-4">
          <motion.div
            ref={stageRef}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-video w-full touch-none overflow-hidden rounded-[18px] bg-black"
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
          >
            <video
              ref={videoRef}
              key={current.id}
              src={current.url}
              className="h-full w-full object-contain"
              playsInline
              preload="metadata"
              style={{ filter: brightness < 1 ? `brightness(${brightness})` : undefined }}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={() => {
                setPlaying(true);
                poke();
              }}
              onPause={onPause}
              onEnded={handleEnded}
              onError={() => setError(t("video.error"))}
            />

            {/* Altyazı katmanı */}
            <AnimatePresence>
              {cueText && (
                <motion.div
                  key={cueText}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute inset-x-0 bottom-[16%] flex justify-center px-6"
                >
                  <span className="rounded-[8px] bg-black/70 px-3 py-1.5 text-center text-[15px] leading-[1.35] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    {cueText}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Çift dokunma uçları */}
            <AnimatePresence>
              {flyLabel && (
                <motion.span
                  key={flyLabel.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: -30, scale: 1 }}
                  exit={{ opacity: 0, y: -60 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`pointer-events-none absolute top-1/2 flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-[15px] font-semibold text-white ${
                    flyLabel.side === "l" ? "left-8" : "right-8"
                  }`}
                >
                  {flyLabel.side === "l" ? "−10" : "+10"}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Ses / parlaklık HUD */}
            <AnimatePresence>
              {hud && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-[14px] bg-black/70 px-4 py-3 text-center text-white ${
                    hud.type === "brightness" ? "left-6" : "right-6"
                  }`}
                >
                  <div className="text-[12px] opacity-80">
                    {hud.type === "brightness" ? t("video.brightness") : t("video.volume")}
                  </div>
                  <div className="text-[17px] font-semibold">
                    %{Math.round(hud.value * 100)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center">
                <p className="text-[14px] leading-[1.45] text-white/85">{error}</p>
                <Button size="sm" variant="secondary" onClick={addVideos}>
                  {t("video.different")}
                </Button>
              </div>
            )}

            {/* Devam ipucu */}
            <AnimatePresence>
              {resumeHint !== null && !error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 rounded-[12px] bg-black/70 px-3 py-2 backdrop-blur-md"
                >
                  <span className="truncate text-[12.5px] text-white/90">
                    {t("video.resumed")} · {formatDuration(resumeHint)}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-semibold text-white"
                    onClick={() => {
                      const video = videoRef.current;
                      if (video && current) {
                        video.currentTime = 0;
                        clearPos(current);
                        setTime(0);
                      }
                      setResumeHint(null);
                    }}
                  >
                    {t("video.restart")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              animate={{ opacity: showControls && !error ? 1 : 0 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/45 via-transparent to-black/65"
            >
              <div />

              <div className="pointer-events-auto flex items-center justify-center gap-7">
                <button
                  type="button"
                  onClick={() => skip(-10)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 active:bg-white/15"
                  aria-label={t("video.back10")}
                >
                  <Back10 size={27} />
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePlay}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md active:bg-white/30"
                  aria-label={playing ? t("video.pause") : t("video.play")}
                >
                  {playing ? <Pause size={30} /> : <Play size={30} className="ml-1" />}
                </motion.button>
                <button
                  type="button"
                  onClick={() => skip(10)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 active:bg-white/15"
                  aria-label={t("video.forward10")}
                >
                  <Forward10 size={27} />
                </button>
              </div>

              <div className="pointer-events-auto px-4 pb-3">
                <input
                  type="range"
                  className="h-6 w-full cursor-pointer accent-white"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(time, duration || 0)}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  aria-label={t("video.seek")}
                />
                <div className="mt-1 flex items-center justify-between text-[12.5px] font-medium text-white/85">
                  <span>
                    {formatDuration(time)} / {formatDuration(duration)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cycleSpeed}
                      className="rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-md active:bg-white/30"
                    >
                      {speed}x
                    </button>
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md active:bg-white/30"
                      aria-label={t("video.fullscreen")}
                    >
                      <Expand size={17} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <div className="mt-3.5">
            <p className="truncate text-[16px] font-semibold">{current.name}</p>
            <p className="mt-0.5 text-[13px] text-ink2">
              {formatBytes(current.size)}
              {duration > 0 ? ` · ${formatDuration(duration)}` : ""}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              size="md"
              variant="secondary"
              className="min-w-[86px] flex-1"
              onClick={() => push({ name: "tool", id: "video-to-mp3", fileId: current.id })}
            >
              <MusicIcon size={18} />
              {t("video.mp3")}
            </Button>
            <Button
              size="md"
              variant={cues ? "primary" : "gray"}
              className="min-w-[86px] flex-1"
              onClick={() => setSubtitleSheet(true)}
            >
              {t("video.subtitles")}
            </Button>
            <Button size="md" variant="gray" className="min-w-[86px] flex-1" onClick={cycleRepeat}>
              {repeat === "one" ? <Repeat1Icon size={18} /> : <RepeatIcon size={18} />}
              {repeatLabel}
            </Button>
            <Button
              size="md"
              variant="gray"
              className="min-w-[86px] flex-1"
              disabled={videos.length < 2}
              onClick={() => playNext(false)}
            >
              {t("video.next")}
            </Button>
            <Button
              size="md"
              variant="gray"
              onClick={() => {
                remove(current.id);
              }}
              aria-label={t("video.removeList")}
            >
              <TrashIcon size={18} />
            </Button>
          </div>

          <p className="mt-3 text-[11.5px] leading-[1.4] text-ink3">
            {t("video.backgroundNote")}
          </p>

          {videos.length > 1 && (
            <>
              <h2 className="mb-2 mt-7 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                {t("video.list")}
              </h2>
              <div className="space-y-2">
                {videos.map((video, index) => {
                  const active = video.id === current.id;
                  return (
                    <motion.div
                      key={video.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 30 }}
                      className={`flex items-center gap-3 rounded-[14px] p-2 pr-1 transition-colors ${
                        active ? "bg-fill" : "bg-card"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentId(video.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="w-4 shrink-0 text-center text-[12px] text-ink3">
                          {index + 1}
                        </span>
                        <div className="h-[46px] w-[80px] shrink-0 overflow-hidden rounded-[9px]">
                          <Thumb entry={video} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] font-medium">{video.name}</p>
                          <p className="text-[12.5px] text-ink2">{formatBytes(video.size)}</p>
                        </div>
                      </button>
                      {active && (
                        <span className="shrink-0 text-[12px] font-semibold text-ink2">
                          {playing ? t("video.playing") : t("video.selected")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(video.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-fill"
                        aria-label={t("video.removeList")}
                      >
                        <TrashIcon size={17} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <Sheet
        open={subtitleSheet}
        onClose={() => setSubtitleSheet(false)}
        title={t("video.subtitles")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-[14px] bg-fill px-4 py-3 text-[14.5px]">
            <span className="truncate">{subtitleName ?? t("video.subtitleNone")}</span>
            {cues && (
              <button
                type="button"
                className="shrink-0 text-[14px] font-medium text-danger"
                onClick={clearSubtitles}
              >
                {t("video.subtitleClear")}
              </button>
            )}
          </div>

          <Button full variant="secondary" size="md" onClick={() => void loadSubtitles()}>
            {t("video.subtitlePick")}
          </Button>

          {subtitleError && <p className="text-[13px] text-danger">{subtitleError}</p>}

          <Slider
            label={t("video.subtitleDelay")}
            display={`${subDelay > 0 ? "+" : ""}${subDelay.toFixed(1)} sn`}
            value={subDelay}
            min={-5}
            max={5}
            step={0.1}
            onChange={(value) => {
              setSubDelay(value);
              setCueText(null);
            }}
          />

          <div className="flex items-center justify-between text-[13px] text-ink2">
            <span className="flex items-center gap-1.5">
              {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
              {t("video.brightness")}
            </span>
            <span>%{Math.round(brightness * 100)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] text-ink2">
            <span>{t("video.volume")}</span>
            <span>%{Math.round(volume * 100)}</span>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
