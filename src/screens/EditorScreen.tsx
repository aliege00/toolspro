import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, NavBar, Sheet } from "@/components/ui";
import {
  ChevronLeft,
  EditorIcon,
  Play,
  PlusIcon,
  ScissorsIcon,
  TextIcon,
  TrashBinIcon,
} from "@/components/Icons";
import { formatDate, formatDuration, pickFiles } from "@/lib/files";
import { useLibrary } from "@/lib/library";
import { useNav } from "@/lib/nav";
import { useEditorT } from "@/editor/labels";
import { deleteProject, listProjects, saveProject } from "@/editor/projectStore";
import Preview from "@/editor/Preview";
import Timeline from "@/editor/Timeline";
import Inspector from "@/editor/Inspector";
import ExportSheet from "@/editor/ExportSheet";
import { probeDuration, resolveEntry } from "@/editor/media";
import { clamp, clipFromEntry, clipEnd, createProject, createTrack, freeStart, projectDuration, sortedClips, textClip } from "@/editor/types";
import type { Clip, Project, TrackKind } from "@/editor/types";

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
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-fill"
                      aria-label={t("deleteProject")}
                    >
                      <TrashBinIcon size={17} />
                    </button>
                  )}
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
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved">("saved");
  const [toast, setToast] = useState<string | null>(null);
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

  useEffect(() => {
    let timer: number | undefined;
    setSaveState("saving");
    timer = window.setTimeout(() => {
      void saveProject(project)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("saving"));
    }, 650);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [project]);

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
      if (!shouldMerge) {
        setPast((stack) => [...stack.slice(-79), cloneProject(current)]);
        setFuture([]);
      }
      lastMerge.current = mergeKey
        ? { key: mergeKey, at: now }
        : { key: "", at: 0 };
      projectRef.current = next;
      setProject(next);
    },
    [],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = cloneProject(projectRef.current);
    setPast(past.slice(0, -1));
    setFuture([...future, current]);
    projectRef.current = previous;
    setProject(previous);
    lastMerge.current = { key: "", at: 0 };
  }, [past, future]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = cloneProject(projectRef.current);
    setFuture(future.slice(0, -1));
    setPast([...past, current]);
    projectRef.current = next;
    setProject(next);
    lastMerge.current = { key: "", at: 0 };
  }, [past, future]);

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
            next.duration = clamp(span / next.speed, 0.1, 6 * 60 * 60);
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

  const addText = useCallback(() => {
    const track = project.tracks.find((item) => item.kind === "text") ?? null;
    if (!track) {
      addTrack("text");
      return;
    }
    const duration = 3;
    const start = freeStart(track, playheadRef.current, duration);
    const clip = textClip(start, duration);
    commit((draft) => {
      const target = draft.tracks.find((item) => item.kind === "text");
      if (target) {
        target.clips.push(clip);
        target.clips = sortedClips(target);
      }
    });
    setSelectedId(clip.id);
  }, [addTrack, commit, project.tracks]);

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
            <p className="text-[10.5px] text-ink3">
              {saveState === "saving" ? t("saving") : t("saved")} · {t("autoSave")}
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
        canUndo={past.length > 0}
        canRedo={future.length > 0}
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
