import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  AudioNotification,
  isNative,
  requestNotificationAccess,
} from "./native";
import { useT } from "@/i18n";

export type AudioTrack = {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
};

export type RepeatMode = "off" | "all" | "one";

type AudioCtx = {
  current: AudioTrack | null;
  queue: AudioTrack[];
  playing: boolean;
  position: number;
  duration: number;
  repeat: RepeatMode;
  error: string | null;
  playerOpen: boolean;
  openPlayer: () => void;
  closePlayer: () => void;
  playQueue: (tracks: AudioTrack[], startId?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setRepeat: (mode: RepeatMode) => void;
  stop: () => void;
};

const Ctx = createContext<AudioCtx | null>(null);
const ActiveCtx = createContext(false);
const ActionsCtx = createContext<{
  playQueue: AudioCtx["playQueue"];
  openPlayer: AudioCtx["openPlayer"];
  closePlayer: AudioCtx["closePlayer"];
  stop: AudioCtx["stop"];
} | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeatState] = useState<RepeatMode>("off");
  const [error, setError] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const queueRef = useRef<AudioTrack[]>([]);
  const indexRef = useRef(-1);
  const repeatRef = useRef<RepeatMode>("off");
  const endedRef = useRef<() => void>(() => undefined);
  const actionRef = useRef<(action: string, at?: number) => void>(() => undefined);

  const current = index >= 0 ? (queue[index] ?? null) : null;

  const load = useCallback(
    (track: AudioTrack, autoplay: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;
      setError(null);
      setPosition(0);
      setDuration(0);
      audio.src = track.url;
      audio.load();
      if (autoplay) {
        void audio.play().catch(() => setError(t("audio.error")));
      }
    },
    [t],
  );

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    queueRef.current = [];
    indexRef.current = -1;
    setQueue([]);
    setIndex(-1);
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    setPlayerOpen(false);
    if (isNative()) void AudioNotification.stop().catch(() => undefined);
  }, []);

  const next = useCallback(() => {
    const list = queueRef.current;
    if (list.length === 0) return;
    let target = indexRef.current + 1;
    if (target >= list.length) {
      if (repeatRef.current === "all") target = 0;
      else return;
    }
    indexRef.current = target;
    setIndex(target);
    load(list[target], true);
  }, [load]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    const list = queueRef.current;
    if (!audio || list.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let target = indexRef.current - 1;
    if (target < 0) {
      if (repeatRef.current === "all") target = list.length - 1;
      else {
        audio.currentTime = 0;
        return;
      }
    }
    indexRef.current = target;
    setIndex(target);
    load(list[target], true);
  }, [load]);

  const playQueue = useCallback(
    (tracks: AudioTrack[], startId?: string) => {
      if (tracks.length === 0) return;
      const found = startId ? tracks.findIndex((track) => track.id === startId) : 0;
      const target = found >= 0 ? found : 0;
      queueRef.current = tracks;
      indexRef.current = target;
      setQueue(tracks);
      setIndex(target);
      load(tracks[target], true);
      setPlayerOpen(true);
      if (isNative()) void requestNotificationAccess().catch(() => undefined);
    },
    [load],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      void audio.play().catch(() => setError(t("audio.error")));
    } else {
      audio.pause();
    }
  }, [current, t]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = Math.min(Math.max(0, seconds), max);
    setPosition(audio.currentTime);
  }, []);

  const setRepeat = useCallback((mode: RepeatMode) => {
    repeatRef.current = mode;
    setRepeatState(mode);
  }, []);

  /* Ses öğesi ve olayları (uygulama boyunca tek örnek). */
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      if (audio.currentSrc) setError(t("audio.error"));
    };
    const onEnded = () => endedRef.current();

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);

    endedRef.current = () => {
      const list = queueRef.current;
      if (repeatRef.current === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
        return;
      }
      const last = indexRef.current >= list.length - 1;
      if (last && repeatRef.current === "off") {
        setPlaying(false);
        setPosition(audio.duration || 0);
        return;
      }
      next();
    };

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Web MediaSession: kilit ekranı / bluetooth kulaklık kontrolleri. */
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const audio = audioRef.current;
    if (!current) return;
    try {
      if ("MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.title,
          artist: current.subtitle ?? "BeyTool",
          album: "BeyTool",
        });
      }
      navigator.mediaSession.setActionHandler("play", () => void audio?.play());
      navigator.mediaSession.setActionHandler("pause", () => audio?.pause());
      navigator.mediaSession.setActionHandler("nexttrack", next);
      navigator.mediaSession.setActionHandler("previoustrack", previous);
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        if (audio) {
          audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
        }
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (audio && typeof details.seekTime === "number") {
          audio.currentTime = details.seekTime;
        }
      });
    } catch {
      // Bazı WebView sürümleri tüm eylemleri desteklemez.
    }
    return () => {
      if (!("mediaSession" in navigator)) return;
      for (const action of [
        "play",
        "pause",
        "nexttrack",
        "previoustrack",
        "seekbackward",
        "seekforward",
        "seekto",
      ] as const) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // yoksay
        }
      }
    };
  }, [current, next, previous]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!current || !isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(position, duration),
      });
    } catch {
      // konum bilgisi desteklenmiyor
    }
  }, [current, duration, position]);

  /* Native bildirim köprüsü: uygulama arka plandayken süreci canlı tutar. */
  useEffect(() => {
    if (!isNative()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let disposed = false;
    void AudioNotification.addListener("action", (data) => {
      actionRef.current(data.action, data.position);
    })
      .then((listener) => {
        if (disposed) void listener.remove();
        else handle = listener;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (handle) void handle.remove();
    };
  }, []);

  actionRef.current = (action, at) => {
    if (action === "play") void audioRef.current?.play().catch(() => undefined);
    else if (action === "pause") audioRef.current?.pause();
    else if (action === "next") next();
    else if (action === "previous") previous();
    else if (action === "seek" && typeof at === "number") seek(at);
  };

  const lastNativePosition = useRef(-1);
  const nativeStarted = useRef(false);
  const notificationAsked = useRef(false);

  useEffect(() => {
    if (!isNative() || !current) return;
    const payload = {
      title: current.title,
      duration,
      position,
      playing,
    };
    const send = async () => {
      try {
        if (!notificationAsked.current) {
          notificationAsked.current = true;
          await requestNotificationAccess();
        }
        if (!nativeStarted.current) {
          nativeStarted.current = true;
          await AudioNotification.start(payload);
        } else {
          await AudioNotification.update(payload);
        }
      } catch {
        // Bildirim izni yoksa ses yine de çalar.
      }
    };
    lastNativePosition.current = Math.floor(position);
    void send();
  }, [current, duration, playing]);

  useEffect(() => {
    if (!isNative() || !current) return;
    const whole = Math.floor(position);
    if (whole === lastNativePosition.current) return;
    lastNativePosition.current = whole;
    void AudioNotification.update({
      title: current.title,
      duration,
      position,
      playing,
    }).catch(() => undefined);
  }, [position, current, duration, playing]);

  useEffect(() => {
    if (!current && nativeStarted.current) {
      nativeStarted.current = false;
      void AudioNotification.stop().catch(() => undefined);
    }
  }, [current]);

  const openPlayer = useCallback(() => setPlayerOpen(true), []);
  const closePlayer = useCallback(() => setPlayerOpen(false), []);

  const value = useMemo<AudioCtx>(
    () => ({
      current,
      queue,
      playing,
      position,
      duration,
      repeat,
      error,
      playerOpen,
      openPlayer,
      closePlayer,
      playQueue,
      toggle,
      next,
      previous,
      seek,
      setRepeat,
      stop,
    }),
    [
      current,
      queue,
      playing,
      position,
      duration,
      repeat,
      error,
      playerOpen,
      openPlayer,
      closePlayer,
      playQueue,
      toggle,
      next,
      previous,
      seek,
      setRepeat,
      stop,
    ],
  );

  const actions = useMemo(
    () => ({ playQueue, openPlayer, closePlayer, stop }),
    [playQueue, openPlayer, closePlayer, stop],
  );

  return (
    <ActiveCtx.Provider value={!!current}>
      <ActionsCtx.Provider value={actions}>
        <Ctx.Provider value={value}>{children}</Ctx.Provider>
      </ActionsCtx.Provider>
    </ActiveCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}

/** Yalnızca çalar açık mı bilgisi (sık güncellenen konumdan etkilenmez). */
export function useAudioActive() {
  return useContext(ActiveCtx);
}

/** Kararlı eylemler: dosya ekranının her saniye yeniden çizilmesini önler. */
export function useAudioActions() {
  const ctx = useContext(ActionsCtx);
  if (!ctx) throw new Error("useAudioActions must be used within AudioProvider");
  return ctx;
}
