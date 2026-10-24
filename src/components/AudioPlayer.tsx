import { AnimatePresence, motion } from "framer-motion";
import { Sheet, Slider } from "@/components/ui";
import { MedyaMark } from "@/components/Brand";
import {
  MusicIcon,
  Pause,
  Play,
  Repeat1Icon,
  RepeatIcon,
  SkipBack,
  SkipForward,
} from "@/components/Icons";
import { formatDuration } from "@/lib/files";
import { useAudio } from "@/lib/audio";
import { useT } from "@/i18n";

export function AudioMiniPlayer() {
  const t = useT();
  const {
    current,
    playing,
    position,
    duration,
    toggle,
    next,
    openPlayer,
  } = useAudio();

  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ y: 84, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 84, opacity: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
          style={{ bottom: "max(10px, env(safe-area-inset-bottom))" }}
          className="fixed inset-x-3 z-40 flex items-center gap-1 overflow-hidden rounded-[18px] border border-white/5 bg-card2/95 pr-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl"
        >
          <motion.span
            aria-hidden
            className="absolute top-0 left-0 h-[2px] rounded-full bg-tint"
            animate={{ width: `${ratio * 100}%` }}
            transition={{ ease: "linear", duration: 0.4 }}
          />
          <button
            type="button"
            onClick={openPlayer}
            className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-2.5 text-left active:opacity-70"
          >
            <MedyaMark size={38} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{current.title}</p>
              <p className="truncate text-[11.5px] text-ink2">
                {current.subtitle ?? t("audio.player")}
              </p>
            </div>
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={toggle}
            aria-label={playing ? t("video.pause") : t("video.play")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-fill"
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={next}
            aria-label={t("video.next")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink2 active:bg-fill"
          >
            <SkipForward size={19} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AudioPlayerSheet() {
  const t = useT();
  const {
    current,
    queue,
    playing,
    position,
    duration,
    repeat,
    error,
    playerOpen,
    closePlayer,
    toggle,
    next,
    previous,
    seek,
    setRepeat,
    playQueue,
  } = useAudio();

  const cycleRepeat = () => {
    setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off");
  };

  return (
    <Sheet open={playerOpen && !!current} onClose={closePlayer} title={t("audio.player")}>
      {current && (
        <div className="space-y-5">
          <div className="flex justify-center pt-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="relative flex h-[170px] w-[170px] items-center justify-center overflow-hidden rounded-[28px] border border-white/5 bg-gradient-to-b from-card2 to-fill shadow-[var(--shadow-card)]"
            >
              <motion.div
                animate={playing ? { scale: [1, 1.035, 1] } : { scale: 1 }}
                transition={
                  playing
                    ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.3 }
                }
              >
                <MedyaMark size={84} radius={20} />
              </motion.div>
              <span className="absolute right-3 bottom-3 text-ink3">
                <MusicIcon size={18} />
              </span>
            </motion.div>
          </div>

          <div className="text-center">
            <p className="truncate text-[18px] font-semibold">{current.title}</p>
            <p className="mt-0.5 truncate text-[13px] text-ink2">
              {current.subtitle ?? t("audio.backgroundNote")}
            </p>
          </div>

          <Slider
            label={t("audio.position")}
            display={`${formatDuration(position)} / ${formatDuration(duration)}`}
            value={Math.min(position, Math.max(0, duration))}
            min={0}
            max={Math.max(0.1, duration)}
            step={0.5}
            onChange={seek}
          />

          <div className="flex items-center justify-center gap-5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={cycleRepeat}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                repeat === "off" ? "text-ink3" : "bg-tint2 text-tint"
              }`}
              aria-label={t("video.repeat")}
            >
              {repeat === "one" ? <Repeat1Icon size={20} /> : <RepeatIcon size={20} />}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={previous}
              className="flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-fill"
              aria-label={t("audio.previous")}
            >
              <SkipBack size={26} />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={toggle}
              className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-tint text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
              aria-label={playing ? t("video.pause") : t("video.play")}
            >
              {playing ? <Pause size={30} /> : <Play size={30} />}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={next}
              className="flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-fill"
              aria-label={t("video.next")}
            >
              <SkipForward size={26} />
            </motion.button>

            <span className="flex h-10 w-10 items-center justify-center rounded-full text-ink3">
              <span className="text-[11px] font-medium">
                {queue.length > 0 ? `${Math.max(1, queue.findIndex((q) => q.id === current.id) + 1)}/${queue.length}` : "—"}
              </span>
            </span>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-[12px] bg-danger/10 px-3.5 py-3 text-[13px] leading-[1.45] text-danger"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {queue.length > 1 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
                {t("audio.queue")}
              </p>
              <div className="space-y-1.5">
                {queue.slice(0, 12).map((track) => {
                  const active = track.id === current.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => playQueue(queue, track.id)}
                      className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left active:opacity-70 ${
                        active ? "bg-tint2" : "bg-fill"
                      }`}
                    >
                      <MusicIcon
                        size={17}
                        className={active ? "shrink-0 text-tint" : "shrink-0 text-ink3"}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">
                        {track.title}
                      </span>
                      {active && playing && (
                        <span className="flex items-end gap-[2px] text-tint" aria-hidden>
                          {[0, 1, 2].map((bar) => (
                            <motion.span
                              key={bar}
                              className="w-[2.5px] rounded-full bg-tint"
                              animate={{ height: [5, 12, 7] }}
                              transition={{
                                duration: 0.9 + bar * 0.18,
                                repeat: Infinity,
                                repeatType: "mirror",
                                ease: "easeInOut",
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-center text-[11.5px] leading-[1.4] text-ink3">
            {t("audio.backgroundNote")}
          </p>
        </div>
      )}
    </Sheet>
  );
}
