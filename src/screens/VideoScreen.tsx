import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button, EmptyState, NavBar } from "@/components/ui";
import Thumb from "@/components/Thumb";
import {
  Back10,
  Expand,
  Forward10,
  MusicIcon,
  Pause,
  Play,
  TrashIcon,
  VideoIcon,
} from "@/components/Icons";
import { formatBytes, formatDuration, pickFiles } from "@/lib/files";
import { useLibrary } from "@/lib/library";
import { useNav } from "@/lib/nav";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoScreen({ fileId }: { fileId?: string }) {
  const { pop, push } = useNav();
  const { entries, addFiles, remove } = useLibrary();
  const videos = useMemo(() => entries.filter((e) => e.kind === "video"), [entries]);

  const [currentId, setCurrentId] = useState<string | null>(fileId ?? null);
  const current = useMemo(() => {
    if (currentId) {
      const found = videos.find((v) => v.id === currentId);
      if (found) return found;
    }
    return videos[0] ?? null;
  }, [currentId, videos]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const poke = useCallback(() => {
    setShowControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 3200);
  }, []);

  useEffect(() => {
    setTime(0);
    setDuration(0);
    setPlaying(false);
    setError(null);
    setSpeed(1);
    poke();
  }, [current?.id, poke]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, current?.id]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      const video = videoRef.current;
      if (video && Math.abs(video.currentTime - last) > 0.08) {
        last = video.currentTime;
        setTime(last);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || error) return;
    if (video.paused) {
      void video.play().catch(() => setError("Video başlatılamadı."));
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

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        try {
          await screen.orientation.lock("landscape");
        } catch {
          /* bazı cihazlarda yatay kilidi desteklenmez */
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

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar
        title="Video Oynat"
        subtitle={videos.length > 0 ? `${videos.length} video` : undefined}
        onBack={pop}
        right={
          <Button size="sm" variant="secondary" onClick={addVideos}>
            Video Ekle
          </Button>
        }
      />

      {videos.length === 0 || !current ? (
        <EmptyState
          icon={<VideoIcon size={30} />}
          title="Henüz video yok"
          description="Oynatmak için cihazından video seç. Seçilen videolar bu oturumda listede kalır."
        >
          <Button full onClick={addVideos}>
            Video Seç
          </Button>
        </EmptyState>
      ) : (
        <div className="px-4 pt-4">
          <motion.div
            ref={stageRef}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-black"
            onPointerDown={poke}
          >
            <video
              ref={videoRef}
              key={current.id}
              src={current.url}
              className="h-full w-full object-contain"
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onPlay={() => {
                setPlaying(true);
                poke();
              }}
              onPause={() => {
                setPlaying(false);
                setShowControls(true);
                window.clearTimeout(hideTimer.current);
              }}
              onEnded={() => {
                setPlaying(false);
                setShowControls(true);
              }}
              onError={() =>
                setError(
                  "Bu video oynatılamadı. Cihaz bu codec'i desteklemiyor olabilir.",
                )
              }
            />

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center">
                <p className="text-[14px] leading-[1.45] text-white/85">{error}</p>
                <Button size="sm" variant="secondary" onClick={addVideos}>
                  Farklı Video Seç
                </Button>
              </div>
            )}

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
                  aria-label="10 saniye geri"
                >
                  <Back10 size={27} />
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePlay}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md active:bg-white/30"
                  aria-label={playing ? "Duraklat" : "Oynat"}
                >
                  {playing ? <Pause size={30} /> : <Play size={30} className="ml-1" />}
                </motion.button>
                <button
                  type="button"
                  onClick={() => skip(10)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 active:bg-white/15"
                  aria-label="10 saniye ileri"
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
                  aria-label="Zaman"
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
                      aria-label="Tam ekran"
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

          <div className="mt-4 flex gap-2.5">
            <Button
              size="md"
              variant="secondary"
              className="flex-1"
              onClick={() => push({ name: "tool", id: "video-to-mp3", fileId: current.id })}
            >
              <MusicIcon size={18} />
              MP3 Çıkar
            </Button>
            <Button
              size="md"
              variant="gray"
              onClick={() => {
                remove(current.id);
              }}
            >
              <TrashIcon size={18} />
            </Button>
          </div>

          {videos.length > 1 && (
            <>
              <h2 className="mb-2 mt-7 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                Videoların
              </h2>
              <div className="space-y-2">
                {videos.map((video) => {
                  const active = video.id === current.id;
                  return (
                    <motion.div
                      key={video.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 30 }}
                      className={`flex items-center gap-3 rounded-[14px] p-2 pr-1 transition-colors ${
                        active ? "bg-tint2" : "bg-card"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentId(video.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="h-[46px] w-[80px] shrink-0 overflow-hidden rounded-[9px]">
                          <Thumb entry={video} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] font-medium">
                            {video.name}
                          </p>
                          <p className="text-[12.5px] text-ink2">
                            {formatBytes(video.size)}
                          </p>
                        </div>
                      </button>
                      {active && (
                        <span className="shrink-0 text-[12px] font-semibold text-tint">
                          {playing ? "Oynatılıyor" : "Seçili"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(video.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-fill"
                        aria-label="Listeden kaldır"
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
    </div>
  );
}
