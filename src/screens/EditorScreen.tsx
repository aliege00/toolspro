import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Button, NavBar, Sheet } from "@/components/ui";
import {
  ChevronLeft,
  DuplicateIcon,
  EditorIcon,
  Play,
  PlusIcon,
  RenameIcon,
  ScissorsIcon,
  TextIcon,
  TrashBinIcon,
} from "@/components/Icons";
import { formatDate, formatDuration, pickFiles } from "@/lib/files";
import { useLibrary } from "@/lib/library";
import { useNav } from "@/lib/nav";
import { requestMicAccess } from "@/lib/native";
import { useEditorT } from "@/editor/labels";
import {
  deleteProject,
  duplicateProject,
  listProjects,
  renamedProject,
  saveProject,
} from "@/editor/projectStore";
import Preview from "@/editor/Preview";
import Timeline from "@/editor/Timeline";
import Inspector from "@/editor/Inspector";
import ExportSheet from "@/editor/ExportSheet";
import { probeDuration, resolveEntry } from "@/editor/media";
import { readPackAssetBlob } from "@/packs/install";
import { parseSrt } from "@/lib/srt";
import { subtitleClips } from "@/editor/core/subtitles";
import { moveClipToTrack } from "@/editor/core/timeline";
import type { PackMusicItem, PackStickerItem } from "@/packs/types";
import { clamp, clipFromEntry, clipEnd, createProject, createTrack, freeStart, projectDuration, sortedClips, textClip } from "@/editor/types";
import type { Clip, ClipText, Project, TrackKind } from "@/editor/types";
import { History, snapshotCommand } from "@/editor/core/history";

function clipCount(project: Project): number {
  return project.tracks.reduce((count, track) => count + track.clips.length, 0);
}

function cloneJSON<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneProject(project: Project): Project {
  return cloneJSON(project);
}

function cloneClipData(clip: Clip): Clip {
  return cloneJSON(clip);
}

export default function EditorScreen() {
  const t = useEditorT();
  const { pop } = useNav();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [active, setActive] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    const project = createProject(newName.trim() || `${t("newProject")} ${(projects?.length ?? 0) + 1}`);
    try {
      await saveProject(project);
      setProjects((current) => [project, ...(current ?? [])]);
      setActive(project);
      setCreating(false);
      setNewName("");
    } catch {
      setError(t("error"));
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((current) => (current ?? []).filter((project) => project.id !== id));
      setConfirmId(null);
    } catch {
      setError(t("error"));
    }
  };

  const duplicate = async (project: Project) => {
    try {
      const copy = duplicateProject(project, `${project.name} ${t("copySuffix")}`);
      await saveProject(copy);
      setProjects((current) => [copy, ...(current ?? [])]);
    } catch {
      setError(t("error"));
    }
  };

  const rename = async () => {
    const project = projects?.find((item) => item.id === renameId);
    if (!project) return;
    try {
      const next = renamedProject(project, renameName);
      await saveProject(next);
      setProjects((current) =>
        (current ?? []).map((item) => (item.id === next.id ? next : item)),
      );
      setRenameId(null);
    } catch {
      setError(t("error"));
    }
  };

  if (active) {
    return (
      <EditorWorkspace
        initial={active}
        onExit={async () => {
          setActive(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar
        title={t("title")}
        subtitle={t("projectsDesc")}
        onBack={pop}
        right={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink2 active:opacity-60"
            aria-label={t("newProject")}
          >
            <PlusIcon size={19} />
          </button>
        }
      />

      <div className="px-4 pt-4">
        {projects === null ? (
          <div className="flex flex-col items-center py-20">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink3 border-t-transparent" />
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center px-6 py-16 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-tile text-tile-ink">
              <EditorIcon size={30} />
            </span>
            <h2 className="mt-4 text-[19px] font-semibold">{t("noProjects")}</h2>
            <p className="mt-1.5 max-w-[300px] text-[13.5px] leading-[1.45] text-ink2">
              {t("noProjectsDesc")}
            </p>
            <Button className="mt-6 w-full max-w-[300px]" onClick={() => setCreating(true)}>
              <PlusIcon size={18} />
              {t("newProject")}
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {projects.map((project, index) => {
              const duration = projectDuration(project);
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.35 }}
                  className="flex items-center gap-3 rounded-[16px] bg-card p-3 shadow-[var(--shadow-card)]"
                >
                  <button
                    type="button"
                    onClick={() => setActive(project)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
                  >
                    <span
                      className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[12px] border border-line bg-fill text-tile-ink"
                      style={{ aspectRatio: project.aspect.replace(":", " / ") }}
                    >
                      <EditorIcon size={23} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold">
                        {project.name}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ink2">
                        {t("clipCount", { n: clipCount(project) })} · {formatDuration(duration)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink3">
                        {t("updated")}: {formatDate(project.updatedAt)}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => void duplicate(project)}
                      className="flex h-9 w-8 items-center justify-center rounded-full text-ink3 active:bg-fill"
                      aria-label={t("duplicate")}
                    >
                      <DuplicateIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameId(project.id);
                        setRenameName(project.name);
                      }}
                      className="flex h-9 w-8 items-center justify-center rounded-full text-ink3 active:bg-fill"
                      aria-label={t("renameProject")}
                    >
                      <RenameIcon size={16} />
                    </button>
                    {confirmId === project.id ? (
                      <button
                        type="button"
                        onClick={() => void remove(project.id)}
                        className="shrink-0 rounded-[9px] bg-fill px-2.5 py-2 text-[11.5px] font-medium text-danger"
                      >
                        {t("deleteProjectConfirm")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(project.id)}
                        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-fill"
                        aria-label={t("deleteProject")}
                      >
                        <TrashBinIcon size={17} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            <Button
              full
              variant="gray"
              className="mt-2"
              onClick={() => setCreating(true)}
            >
              <PlusIcon size={18} />
              {t("newProject")}
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-center text-[12.5px] text-danger">{error}</p>
        )}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title={t("newProject")}>
        <div className="space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t("projectName")}
            className="h-12 w-full rounded-[12px] bg-fill px-4 text-[16px] outline-none placeholder:text-ink3"
          />
          <Button full onClick={() => void create()}>
            {t("create")}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={!!renameId}
        onClose={() => setRenameId(null)}
        title={t("renameProject")}
      >
        <div className="space-y-3">
          <input
            autoFocus
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            placeholder={t("projectName")}
            className="h-12 w-full rounded-[12px] bg-fill px-4 text-[16px] outline-none placeholder:text-ink3"
          />
          <Button full onClick={() => void rename()} disabled={!renameName.trim()}>
            {t("save")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function EditorWorkspace({
  initial,
  onExit,
}: {
  initial: Project;
  onExit: () => Promise<void> | void;
}) {
  const t = useEditorT();
  const { entries, addFiles } = useLibrary();
  const [project, setProject] = useState<Project>(initial);
  const projectRef = useRef(project);
  projectRef.current = project;
  const historyRef = useRef<History<Project> | null>(null);
  if (!historyRef.current) historyRef.current = new History<Project>(initial, 100);
  const [, setHistoryVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textEditSignal, setTextEditSignal] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">("saved");
  const [toast, setToast] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);
  const lastMerge = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  const totalDuration = useMemo(() => projectDuration(project), [project]);
  const selectedClip = useMemo(() => {
    if (!selectedId) return null;
    for (const track of project.tracks) {
      const clip = track.clips.find((item) => item.id === selectedId);
      if (clip) return clip;
    }
    return null;
  }, [project, selectedId]);
  const selectedTrack = useMemo(
    () =>
      selectedId
        ? project.tracks.find((track) =>
            track.clips.some((clip) => clip.id === selectedId),
          ) ?? null
        : null,
    [project, selectedId],
  );
  const selectedEntry = selectedClip
    ? resolveEntry(selectedClip, entries)
    : undefined;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1900);
  };

  const seek = useCallback(
    (value: number) => {
      const next = clamp(value, 0, Math.max(0.01, projectDuration(projectRef.current)));
      playheadRef.current = next;
      setPlayhead(next);
    },
    [],
  );

  useEffect(() => {
    if (playheadRef.current > totalDuration) seek(totalDuration);
  }, [totalDuration, seek]);

  const persistNow = useCallback(() => {
    setSaveState("saving");
    void saveProject(projectRef.current)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    setSaveState("saving");
    timer = window.setTimeout(() => {
      void saveProject(project)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 650);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [project]);

  // Uygulama arka plana giderken bekleyen 650 ms'lik kaydı beklemeden yaz.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persistNow();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let disposed = false;
    const handles: { remove: () => Promise<void> }[] = [];
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener("pause", persistNow).then((handle) => {
        if (disposed) void handle.remove();
        else handles.push(handle);
      });
      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) persistNow();
      }).then((handle) => {
        if (disposed) void handle.remove();
        else handles.push(handle);
      });
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      for (const handle of handles) void handle.remove();
    };
  }, [persistNow]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const total = projectDuration(projectRef.current);
    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = playheadRef.current + delta;
      if (next >= total) {
        playheadRef.current = total;
        setPlayhead(total);
        setPlaying(false);
        return;
      }
      playheadRef.current = next;
      setPlayhead(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const commit = useCallback(
    (mutator: (draft: Project) => void, mergeKey?: string) => {
      const current = projectRef.current;
      const next = cloneProject(current);
      mutator(next);
      next.updatedAt = Date.now();
      const now = Date.now();
      const shouldMerge =
        !!mergeKey &&
        lastMerge.current.key === mergeKey &&
        now - lastMerge.current.at < 1200;
      const history = historyRef.current!;
      if (shouldMerge) {
        history.amend(next);
      } else {
        history.execute(snapshotCommand(current, next, mergeKey ?? "düzenleme"));
      }
      lastMerge.current = mergeKey
        ? { key: mergeKey, at: now }
        : { key: "", at: 0 };
      projectRef.current = next;
      setProject(next);
      setHistoryVersion((value) => value + 1);
    },
    [],
  );

  const undo = useCallback(() => {
    const history = historyRef.current!;
    if (!history.canUndo) return;
    const previous = history.undo();
    projectRef.current = previous;
    setProject(previous);
    setHistoryVersion((value) => value + 1);
    lastMerge.current = { key: "", at: 0 };
  }, []);

  const redo = useCallback(() => {
    const history = historyRef.current!;
    if (!history.canRedo) return;
    const next = history.redo();
    projectRef.current = next;
    setProject(next);
    setHistoryVersion((value) => value + 1);
    lastMerge.current = { key: "", at: 0 };
  }, []);

  const patchProject = useCallback(
    (patch: Partial<Project>, mergeKey?: string) => {
      commit((draft) => {
        Object.assign(draft, patch);
      }, mergeKey);
    },
    [commit],
  );

  const patchClip = useCallback(
    (clipId: string, patch: Partial<Clip>, mergeKey?: string) => {
      commit((draft) => {
        for (const track of draft.tracks) {
          const index = track.clips.findIndex((clip) => clip.id === clipId);
          if (index === -1) continue;
          const original = track.clips[index];
          const next: Clip = { ...original, ...patch };
          if (
            patch.speed !== undefined &&
            original.kind !== "image" &&
            original.kind !== "text"
          ) {
            const span = original.duration * original.speed;
            const nextStart = track.clips
              .filter((item) => item.id !== clipId && item.start >= original.start + 0.001)
              .reduce((min, item) => Math.min(min, item.start), Number.POSITIVE_INFINITY);
            const room =
              Number.isFinite(nextStart) ? nextStart - original.start : 6 * 60 * 60;
            next.duration = clamp(span / next.speed, 0.1, Math.max(0.1, Math.min(room, 6 * 60 * 60)));
            next.fadeIn = Math.min(next.fadeIn, next.duration / 2);
            next.fadeOut = Math.min(next.fadeOut, next.duration / 2);
          }
          track.clips[index] = next;
          return;
        }
      }, mergeKey);
    },
    [commit],
  );

  const moveClip = useCallback(
    (clipId: string, desired: number) => {
      commit((draft) => {
        for (const track of draft.tracks) {
          const clip = track.clips.find((item) => item.id === clipId);
          if (!clip) continue;
          const others = track.clips.filter((item) => item.id !== clipId);
          let start = Math.max(0, desired);
          for (const other of others) {
            const otherEnd = clipEnd(other);
            if (start < otherEnd && start + clip.duration > other.start) {
              start = desired < other.start ? other.start - clip.duration : otherEnd;
            }
          }
          clip.start = Math.max(0, start);
          track.clips = sortedClips(track);
          return;
        }
      });
    },
    [commit],
  );

  const trimClip = useCallback(
    (clipId: string, edge: "left" | "right", delta: number) => {
      commit((draft) => {
        for (const track of draft.tracks) {
          const index = track.clips.findIndex((clip) => clip.id === clipId);
          if (index === -1) continue;
          const clip = track.clips[index];
          const others = track.clips
            .filter((item) => item.id !== clipId)
            .sort((a, b) => a.start - b.start);
          const previous = [...others].reverse().find((item) => clipEnd(item) <= clip.start + 0.001);
          const nextClip = others.find((item) => item.start >= clipEnd(clip) - 0.001);
          const minDuration = 0.2;

          if (edge === "left") {
            const sourceLimit =
              clip.kind === "video" || clip.kind === "audio"
                ? clip.start - clip.inPoint / Math.max(0.01, clip.speed)
                : 0;
            const minStart = Math.max(0, sourceLimit, previous ? clipEnd(previous) : 0);
            const maxStart = clipEnd(clip) - minDuration;
            const newStart = clamp(clip.start + delta, minStart, maxStart);
            const shift = newStart - clip.start;
            const newDuration = clip.duration - shift;
            if (clip.kind === "video" || clip.kind === "audio") {
              const maxIn = Math.max(0, clip.sourceDuration - newDuration * clip.speed);
              clip.inPoint = clamp(clip.inPoint + shift * clip.speed, 0, maxIn);
            }
            clip.start = newStart;
            clip.duration = newDuration;
          } else {
            const maxEnd = nextClip ? nextClip.start : Number.POSITIVE_INFINITY;
            const maxDuration = Math.max(
              minDuration,
              Math.min(maxEnd - clip.start, 6 * 60 * 60),
            );
            let maxSource = maxDuration;
            if (clip.kind === "video" || clip.kind === "audio") {
              maxSource = Math.max(
                minDuration,
                (clip.sourceDuration - clip.inPoint) / clip.speed,
              );
            }
            clip.duration = clamp(clip.duration + delta, minDuration, Math.min(maxDuration, maxSource));
            if (clip.kind === "image" || clip.kind === "text") {
              clip.sourceDuration = Math.max(clip.sourceDuration, clip.duration);
            }
          }
          clip.fadeIn = Math.min(clip.fadeIn, clip.duration / 2);
          clip.fadeOut = Math.min(clip.fadeOut, clip.duration / 2);
          track.clips[index] = clip;
          return;
        }
      });
    },
    [commit],
  );

  const split = useCallback(() => {
    const time = playheadRef.current;
    const targetTrack = selectedTrack ?? project.tracks.find((track) => track.kind === "video");
    const target = targetTrack?.clips.find(
      (clip) => time > clip.start + 0.08 && time < clipEnd(clip) - 0.08,
    );
    if (!target || !targetTrack) {
      notify(t("splitError"));
      return;
    }
    commit((draft) => {
      const track = draft.tracks.find((item) => item.id === targetTrack.id);
      if (!track) return;
      const clip = track.clips.find((item) => item.id === target.id);
      if (!clip) return;
      const firstDuration = time - clip.start;
      const secondDuration = clip.duration - firstDuration;
      const right: Clip = {
        ...cloneClipData(clip),
        id: `${clip.id}-r${Date.now().toString(36)}`,
        start: time,
        duration: secondDuration,
        inPoint:
          clip.kind === "video" || clip.kind === "audio"
            ? clip.inPoint + firstDuration * clip.speed
            : clip.inPoint,
      };
      clip.duration = firstDuration;
      track.clips.push(right);
      track.clips = sortedClips(track);
    });
  }, [commit, notify, selectedTrack, project.tracks, t]);

  const duplicate = useCallback(() => {
    if (!selectedClip || !selectedTrack) return;
    commit((draft) => {
      const track = draft.tracks.find((item) => item.id === selectedTrack.id);
      const clip = track?.clips.find((item) => item.id === selectedClip.id);
      if (!track || !clip) return;
      const copy: Clip = {
        ...cloneClipData(clip),
        id: `${clip.id}-d${Date.now().toString(36)}`,
        start: freeStart(track, clipEnd(clip), clip.duration),
      };
      track.clips.push(copy);
      track.clips = sortedClips(track);
    });
  }, [commit, selectedClip, selectedTrack]);

  const deleteClip = useCallback(() => {
    if (!selectedId) return;
    commit((draft) => {
      for (const track of draft.tracks) {
        track.clips = track.clips.filter((clip) => clip.id !== selectedId);
      }
    });
    setSelectedId(null);
  }, [commit, selectedId]);

  const addTrack = useCallback(
    (kind: TrackKind) => {
      commit((draft) => {
        const index = draft.tracks.filter((track) => track.kind === kind).length + 1;
        draft.tracks.push(createTrack(kind, index));
      });
    },
    [commit],
  );

  const toggleMute = useCallback(
    (trackId: string) => {
      commit((draft) => {
        const track = draft.tracks.find((item) => item.id === trackId);
        if (track) track.muted = !track.muted;
      });
    },
    [commit],
  );

  const addMedia = useCallback(async () => {
    const files = await pickFiles({
      multiple: true,
      accept: "video/*,audio/*,image/*",
    });
    if (files.length === 0) return;
    const fresh = addFiles(files);
    const usable = fresh.filter((entry) => entry.kind !== "other");
    if (usable.length === 0) {
      notify(t("noMedia"));
      return;
    }

    const additions: { trackKind: TrackKind; clip: Clip }[] = [];
    for (const entry of usable) {
      const trackKind: TrackKind = entry.kind === "audio" ? "audio" : "video";
      const duration = await probeDuration(entry);
      const existing = projectRef.current.tracks.filter((track) => track.kind === trackKind);
      const track = existing[0];
      const planned = additions.filter((item) => item.trackKind === trackKind);
      const baseTrack = track ?? createTrack(trackKind, 1);
      const start = freeStart(
        { ...baseTrack, clips: [...baseTrack.clips, ...planned.map((item) => item.clip)] },
        playheadRef.current,
        duration,
      );
      const clip = clipFromEntry(entry, start, duration);
      additions.push({ trackKind, clip });
    }

    commit((draft) => {
      for (const addition of additions) {
        let track = draft.tracks.find((item) => item.kind === addition.trackKind);
        if (!track) {
          track = createTrack(addition.trackKind, 1);
          draft.tracks.push(track);
        }
        track.clips.push(addition.clip);
        track.clips = sortedClips(track);
      }
    });
  }, [addFiles, commit, notify, t]);

  const addMusic = useCallback(async () => {
    const files = await pickFiles({ multiple: true, accept: "audio/*" });
    if (files.length === 0) return;
    const fresh = addFiles(files).filter((entry) => entry.kind === "audio");
    if (fresh.length === 0) {
      notify(t("musicMissing"));
      return;
    }
    const additions: Clip[] = [];
    for (const entry of fresh) {
      const duration = await probeDuration(entry);
      const track =
        projectRef.current.tracks.find((item) => item.kind === "audio") ??
        createTrack("audio", 1);
      const start = freeStart(
        { ...track, clips: [...track.clips, ...additions] },
        playheadRef.current,
        duration,
      );
      additions.push(clipFromEntry(entry, start, duration));
    }
    commit((draft) => {
      let target = draft.tracks.find((item) => item.kind === "audio");
      if (!target) {
        target = createTrack("audio", 1);
        draft.tracks.push(target);
      }
      target.clips.push(...additions);
      target.clips = sortedClips(target);
    });
  }, [addFiles, commit, notify, t]);

  const addPip = useCallback(async () => {
    const files = await pickFiles({ accept: "video/*,image/*" });
    if (files.length === 0) return;
    const fresh = addFiles(files).filter((entry) => entry.kind !== "other");
    if (fresh.length === 0) return;
    const additions: Clip[] = [];
    for (const entry of fresh) {
      const duration = await probeDuration(entry);
      const track =
        projectRef.current.tracks.find((item) => item.kind === "overlay") ??
        createTrack("overlay", 1);
      const start = freeStart(
        { ...track, clips: [...track.clips, ...additions] },
        playheadRef.current,
        duration,
      );
      const clip = clipFromEntry(entry, start, duration);
      clip.volume = 0;
      clip.pip = { scale: 0.35, x: 0.6, y: 0.08 };
      additions.push(clip);
    }
    commit((draft) => {
      let target = draft.tracks.find((item) => item.kind === "overlay");
      if (!target) {
        target = createTrack("overlay", draft.tracks.filter((item) => item.kind === "overlay").length + 1);
        draft.tracks.push(target);
      }
      target.clips.push(...additions);
      target.clips = sortedClips(target);
    });
    setSelectedId(additions[0]?.id ?? null);
  }, [addFiles, commit]);

  const addPackMusic = useCallback(
    async (item: PackMusicItem) => {
      try {
        const blob = await readPackAssetBlob(item.packId, item.file);
        const file = new File(
          [blob],
          `${item.title || item.id}.wav`,
          { type: blob.type || "audio/wav" },
        );
        const [entry] = addFiles([file]);
        if (!entry) {
          notify(t("musicMissing"));
          return;
        }
        const duration = await probeDuration(entry);
        const track =
          projectRef.current.tracks.find((trackItem) => trackItem.kind === "audio") ??
          createTrack("audio", 1);
        const start = freeStart(track, playheadRef.current, duration);
        const clip = clipFromEntry(entry, start, duration);
        commit((draft) => {
          let target = draft.tracks.find((trackItem) => trackItem.kind === "audio");
          if (!target) {
            target = createTrack("audio", 1);
            draft.tracks.push(target);
          }
          target.clips.push(clip);
          target.clips = sortedClips(target);
        });
        setSelectedId(clip.id);
      } catch {
        notify(t("error"));
      }
    },
    [addFiles, commit, notify, t],
  );

  const addSticker = useCallback(
    async (item: PackStickerItem) => {
      try {
        const blob = await readPackAssetBlob(item.packId, item.file);
        const file = new File([blob], `${item.id}.png`, { type: "image/png" });
        const [entry] = addFiles([file]);
        if (!entry) return;
        const duration = 3;
        const track =
          projectRef.current.tracks.find((trackItem) => trackItem.kind === "overlay") ??
          createTrack("overlay", 1);
        const start = freeStart(track, playheadRef.current, duration);
        const clip = clipFromEntry(entry, start, duration);
        clip.sourceDuration = duration;
        clip.volume = 0;
        clip.pip = { scale: 0.26, x: 0.62, y: 0.08 };
        commit((draft) => {
          let target = draft.tracks.find((trackItem) => trackItem.kind === "overlay");
          if (!target) {
            target = createTrack(
              "overlay",
              draft.tracks.filter((trackItem) => trackItem.kind === "overlay").length + 1,
            );
            draft.tracks.push(target);
          }
          target.clips.push(clip);
          target.clips = sortedClips(target);
        });
        setSelectedId(clip.id);
      } catch {
        notify(t("error"));
      }
    },
    [addFiles, commit, notify, t],
  );

  const detachAudio = useCallback(() => {
    if (!selectedClip || selectedTrack?.kind !== "video") return;
    commit((draft) => {
      const videoTrack = draft.tracks.find((item) => item.id === selectedTrack.id);
      const source = videoTrack?.clips.find((item) => item.id === selectedClip.id);
      if (!videoTrack || !source) return;
      let audioTrack = draft.tracks.find((item) => item.kind === "audio");
      if (!audioTrack) {
        audioTrack = createTrack("audio", 1);
        draft.tracks.push(audioTrack);
      }
      const copy: Clip = {
        ...cloneClipData(source),
        id: `${source.id}-audio${Date.now().toString(36)}`,
        kind: "audio",
        name: `${source.name} (ses)`,
        start: freeStart(audioTrack, source.start, source.duration),
        volume: source.volume,
      };
      audioTrack.clips.push(copy);
      audioTrack.clips = sortedClips(audioTrack);
      source.volume = 0;
    });
    notify(t("detachDone"));
  }, [commit, notify, selectedClip, selectedTrack, t]);

  const stopVoiceover = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const startVoiceover = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      notify(t("micError"));
      return;
    }
    const granted = await requestMicAccess();
    if (!granted) {
      notify(t("micDenied"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
      ];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const seconds = Math.max(0.3, (Date.now() - recordStartRef.current) / 1000);
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        if (blob.size < 128) return;
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `Seslendirme-${Date.now()}.${extension}`, { type });
        const [entry] = addFiles([file]);
        if (!entry) return;
        const track =
          projectRef.current.tracks.find((item) => item.kind === "audio") ??
          createTrack("audio", 1);
        const start = freeStart(track, playheadRef.current, seconds);
        const clip = clipFromEntry(entry, start, seconds);
        clip.sourceDuration = seconds;
        clip.volume = 1;
        commit((draft) => {
          let target = draft.tracks.find((item) => item.kind === "audio");
          if (!target) {
            target = createTrack("audio", 1);
            draft.tracks.push(target);
          }
          target.clips.push(clip);
          target.clips = sortedClips(target);
        });
        setSelectedId(clip.id);
        notify(t("voiceoverAdded"));
      };
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch {
      notify(t("micError"));
    }
  }, [addFiles, commit, notify, t]);

  const toggleVoiceover = useCallback(() => {
    if (recording) stopVoiceover();
    else void startVoiceover();
  }, [recording, startVoiceover, stopVoiceover]);

  useEffect(
    () => () => {
      try {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      } catch {
        /* yoksay */
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const applyTextStyle = useCallback(
    (style: Partial<ClipText>) => {
      commit((draft) => {
        for (const track of draft.tracks) {
          for (const item of track.clips) {
            if (item.kind !== "text" || !item.text) continue;
            item.text = { ...item.text, ...style };
          }
        }
      });
    },
    [commit],
  );

  const addText = useCallback(() => {
    const duration = 3;
    const track =
      projectRef.current.tracks.find((item) => item.kind === "text") ??
      createTrack("text", 1);
    const start = freeStart(track, playheadRef.current, duration);
    const clip = textClip(start, duration);
    commit((draft) => {
      let target = draft.tracks.find((item) => item.kind === "text");
      if (!target) {
        target = createTrack("text", 1);
        draft.tracks.push(target);
      }
      target.clips.push(clip);
      target.clips = sortedClips(target);
    });
    setSelectedId(clip.id);
    // Metin eklendiği anda düzenleme sayfasını aç: kullanıcı içeriği
    // aşağıdaki panelde aramak zorunda kalmaz.
    setTextEditSignal((value) => value + 1);
  }, [commit]);

  // SRT dosyasındaki altyazılar alt hizalı metin klipleri olarak eklenir.
  const importSrt = useCallback(async () => {
    const files = await pickFiles({ accept: ".srt,text/vtt" });
    const file = files[0];
    if (!file) return;
    try {
      const { cues } = parseSrt(await file.text());
      const clips = subtitleClips(cues, { offset: playheadRef.current });
      if (clips.length === 0) {
        notify(t("importSubsEmpty"));
        return;
      }
      commit((draft) => {
        let target = draft.tracks.find((item) => item.kind === "text");
        if (!target) {
          target = createTrack("text", 1);
          draft.tracks.push(target);
        }
        target.clips.push(...clips);
        target.clips = sortedClips(target);
      });
      notify(t("importSubsDone", { n: clips.length }));
      setSelectedId(clips[0].id);
    } catch {
      notify(t("error"));
    }
  }, [commit, notify, t]);

  const moveToTrack = useCallback(
    (trackId: string) => {
      if (!selectedId) return;
      commit((draft) => {
        const moved = moveClipToTrack(draft, selectedId, trackId);
        draft.tracks = moved.tracks;
      });
    },
    [commit, selectedId],
  );

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (playheadRef.current >= projectDuration(projectRef.current) - 0.05) {
      seek(0);
    }
    setPlaying(true);
  }, [playing, seek]);

  return (
    <div className="safe-bottom min-h-full pb-6">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="flex h-[52px] items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              void (async () => {
                try {
                  await saveProject(projectRef.current);
                } catch {
                  notify(t("error"));
                }
                await onExit();
              })();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-tint active:bg-fill"
            aria-label={t("back")}
          >
            <ChevronLeft size={26} strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{project.name}</p>
            <p
              className={`text-[10.5px] ${
                saveState === "error" ? "text-danger" : "text-ink3"
              }`}
            >
              {saveState === "saving"
                ? t("saving")
                : saveState === "error"
                  ? t("saveError")
                  : t("saved")} · {t("autoSave")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setExportOpen(true);
            }}
            className="rounded-[10px] bg-tint px-3.5 py-2 text-[13px] font-semibold text-white active:opacity-70"
          >
            {t("export")}
          </button>
        </div>
      </header>

      <Preview
        project={project}
        entries={entries}
        playhead={playhead}
        playing={playing}
        selectedClipId={selectedId}
        onTogglePlay={togglePlay}
      />

      <div className="mt-3 px-4">
        <Timeline
          project={project}
          playhead={playhead}
          playing={playing}
          selectedClipId={selectedId}
          onSelect={(clipId) => setSelectedId(clipId)}
          onSeek={seek}
          onMoveClip={moveClip}
          onTrimClip={trimClip}
          onToggleMute={toggleMute}
        />
      </div>

      <div className="mt-3 flex gap-2 px-4">
        <button
          type="button"
          onClick={() => void addMedia()}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-fill text-[12.5px] font-medium text-ink2 active:opacity-60"
        >
          <PlusIcon size={16} />
          {t("addMedia")}
        </button>
        <button
          type="button"
          onClick={addText}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-fill text-[12.5px] font-medium text-ink2 active:opacity-60"
        >
          <TextIcon size={16} />
          {t("addText")}
        </button>
        <button
          type="button"
          onClick={split}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-fill text-[12.5px] font-medium text-ink2 active:opacity-60"
        >
          <ScissorsIcon size={16} />
          {t("split")}
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[11px] bg-fill text-ink2 active:opacity-60"
          aria-label={playing ? t("pause") : t("play")}
        >
          {playing ? <span className="text-[15px]">II</span> : <Play size={16} />}
        </button>
      </div>

      <Inspector
        project={project}
        clip={selectedClip}
        entry={selectedEntry}
        canUndo={historyRef.current?.canUndo ?? false}
        canRedo={historyRef.current?.canRedo ?? false}
        onUndo={undo}
        onRedo={redo}
        onPatchClip={patchClip}
        onPatchProject={patchProject}
        onSplit={split}
        onDuplicate={duplicate}
        onDelete={deleteClip}
        onAddTrack={addTrack}
        onAddMedia={() => void addMedia()}
        onAddText={addText}
        onImportSrt={() => void importSrt()}
        onMoveToTrack={moveToTrack}
        textEditSignal={textEditSignal}
        onApplyTextStyle={applyTextStyle}
        trackKind={selectedTrack?.kind ?? null}
        recording={recording}
        onAddMusic={() => void addMusic()}
        onToggleVoiceover={toggleVoiceover}
        onDetachAudio={detachAudio}
        onAddPip={() => void addPip()}
        onAddPackMusic={(item) => void addPackMusic(item)}
        onAddSticker={(item) => void addSticker(item)}
      />

      <ExportSheet
        open={exportOpen}
        project={project}
        entries={entries}
        onClose={() => setExportOpen(false)}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-0 bottom-10 z-[80] flex justify-center"
          >
            <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg">
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
