import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button, ProgressBar, Sheet } from "@/components/ui";
import { DownloadIcon, ShareIcon } from "@/components/Icons";
import { formatBytes, formatDuration } from "@/lib/files";
import { FFMPEG_WARN_BYTES } from "@/lib/ffmpeg";
import { saveToGallery, shareBlob } from "@/lib/native";
import type { Entry } from "@/lib/library";
import type { ExportQuality, Project } from "./types";
import { clipFromEntry, createProject, projectDuration } from "./types";
import { resolveEntry } from "./media";
import { useEditorT } from "./labels";
import { exportProject, isCancelled } from "./export";
import type { ExportResult } from "./export";

type Stage = "idle" | "running" | "done" | "error";

export default function ExportSheet({
  open,
  project,
  entries,
  onClose,
}: {
  open: boolean;
  project: Project;
  entries: Entry[];
  onClose: () => void;
}) {
  const t = useEditorT();
  const [quality, setQuality] = useState<ExportQuality>(720);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [quick, setQuick] = useState<{
    stage: "idle" | "running" | "done" | "error";
    ms: number;
    size: number;
    error: string | null;
  }>({ stage: "idle", ms: 0, size: 0, error: null });
  const quickController = useRef<AbortController | null>(null);
  const quickStarted = useRef(0);
  const [quickTick, setQuickTick] = useState(0);

  const usedEntries = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.kind === "text") continue;
        const entry = resolveEntry(clip, entries);
        if (entry) map.set(entry.id, entry);
      }
    }
    return [...map.values()];
  }, [project, entries]);

  const sourceBytes = useMemo(
    () => usedEntries.reduce((sum, entry) => sum + entry.size, 0),
    [usedEntries],
  );
  const duration = projectDuration(project);
  const heavy = sourceBytes > FFMPEG_WARN_BYTES || duration > 180;

  const previewUrl = useMemo(
    () => (result ? URL.createObjectURL(result.blob) : null),
    [result],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    if (!open) {
      controller.current?.abort();
      controller.current = null;
      quickController.current?.abort();
      quickController.current = null;
      setStage("idle");
      setProgress(0);
      setError(null);
      setResult(null);
      setToast(null);
      setQuick({ stage: "idle", ms: 0, size: 0, error: null });
    }
  }, [open]);

  useEffect(() => {
    if (quick.stage !== "running") return;
    const timer = window.setInterval(() => setQuickTick((value) => value + 1), 200);
    return () => window.clearInterval(timer);
  }, [quick.stage]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const start = async () => {
    if (stage === "running") return;
    setStage("running");
    setProgress(0.01);
    setError(null);
    setResult(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const output = await exportProject({
        project,
        entries,
        quality,
        signal: abort.signal,
        onProgress: (ratio) => setProgress(ratio),
      });
      setResult(output);
      setStage("done");
      setProgress(1);
    } catch (failure) {
      if (isCancelled(failure) || abort.signal.aborted) {
        setError(t("exportCancelled"));
      } else {
        setError(failure instanceof Error ? failure.message : t("exportFailed"));
      }
      setStage("error");
    } finally {
      controller.current = null;
    }
  };

  const cancel = () => {
    controller.current?.abort();
    setStage("error");
    setError(t("exportCancelled"));
  };

  /** 60 saniyelik sentetik bir görsel klipten 480p çıktı üretip süreyi ölçer. */
  const quickTest = async () => {
    if (quick.stage === "running") return;
    quickController.current?.abort();
    const abort = new AbortController();
    quickController.current = abort;
    quickStarted.current = performance.now();
    setQuick({ stage: "running", ms: 0, size: 0, error: null });

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#1c1c1e";
      context.fillRect(0, 0, 320, 180);
      context.strokeStyle = "#6e6e73";
      for (let i = 0; i < 320; i += 32) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, 180);
        context.stroke();
      }
      context.fillStyle = "#f2efe8";
      context.font = "22px sans-serif";
      context.fillText("BeyTool test", 78, 100);
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), "image/png"),
    );
    if (!blob) {
      setQuick({ stage: "error", ms: 0, size: 0, error: t("quickTestFail") });
      return;
    }

    const file = new File([blob], "beytool-test.png", { type: "image/png" });
    const url = URL.createObjectURL(file);
    const entry: Entry = {
      id: "quick-test",
      key: "quick-test",
      file,
      url,
      kind: "image",
      name: file.name,
      size: file.size,
      folder: "",
      addedAt: Date.now(),
    };
    const testProject = createProject("Hızlı test");
    testProject.aspect = "16:9";
    const clip = clipFromEntry(entry, 0, 60);
    clip.duration = 60;
    clip.sourceDuration = 60;
    testProject.tracks[0].clips = [clip];

    try {
      const output = await exportProject({
        project: testProject,
        entries: [entry],
        quality: 480,
        signal: abort.signal,
      });
      setQuick({
        stage: "done",
        ms: Math.round(performance.now() - quickStarted.current),
        size: output.size,
        error: null,
      });
    } catch (failure) {
      setQuick({
        stage: "error",
        ms: Math.round(performance.now() - quickStarted.current),
        size: 0,
        error:
          isCancelled(failure) || abort.signal.aborted
            ? t("quickTestCanceled")
            : t("quickTestFail"),
      });
    } finally {
      URL.revokeObjectURL(url);
      quickController.current = null;
    }
  };

  const save = async () => {
    if (!result) return;
    const ok = await saveToGallery(result.blob, result.fileName);
    showToast(ok ? t("gallerySaved") : t("galleryFailed"));
  };

  const share = async () => {
    if (!result) return;
    const ok = await shareBlob(result.blob, result.fileName);
    showToast(ok ? t("shared") : t("shareFailed"));
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (stage === "running") controller.current?.abort();
        onClose();
      }}
      title={t("exportTitle")}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[12px] font-semibold tracking-wide text-ink3 uppercase">
            {t("quality")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([480, 720, 1080] as ExportQuality[]).map((option) => (
              <button
                key={option}
                type="button"
                disabled={stage === "running"}
                onClick={() => setQuality(option)}
                className={`rounded-[12px] border py-3 text-[14px] font-medium disabled:opacity-40 ${
                  quality === option
                    ? "border-ink/60 bg-fill text-ink"
                    : "border-line bg-fill/40 text-ink2"
                }`}
              >
                {option}p
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] bg-fill/60 px-3.5 py-3 text-[12px] leading-[1.45] text-ink2">
          <div className="flex items-center justify-between">
            <span>{t("totalDuration")}</span>
            <span className="font-medium text-ink">{formatDuration(duration)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>{t("quality")}</span>
            <span className="font-medium text-ink">{quality}p</span>
          </div>
          <p className="mt-2 border-t border-line pt-2 text-[11.5px]">{t("exportNote")}</p>
          <p className="mt-1.5 text-[11.5px] text-ink3">{t("gapNote")}</p>
        </div>

        {heavy && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[12px] bg-fill px-3.5 py-3 text-[12px] leading-[1.5] text-ink2"
          >
            {t("memoryWarning", { size: formatBytes(sourceBytes) })}
            <br />
            {t("durationWarning")}
          </motion.p>
        )}

        {stage === "running" && (
          <div className="space-y-2">
            <ProgressBar ratio={progress} />
            <div className="flex items-center justify-between text-[12px] text-ink2">
              <span>
                {t("exporting")} · %{Math.round(progress * 100)}
              </span>
              <button type="button" className="font-medium text-danger" onClick={cancel}>
                {t("cancelExport")}
              </button>
            </div>
          </div>
        )}

        {stage === "error" && error && (
          <div className="rounded-[12px] bg-fill px-3.5 py-3 text-[12.5px] leading-[1.5] text-danger">
            {error}
          </div>
        )}

        {stage === "done" && result && previewUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-[13px] font-medium text-success">{t("exportDone")}</p>
            <video
              src={previewUrl}
              controls
              playsInline
              className="max-h-[34vh] w-full rounded-[12px] bg-black"
            />
            <p className="text-[11.5px] text-ink3">
              {result.fileName} · {formatBytes(result.size)}
            </p>
            <div className="flex gap-2">
              <Button size="md" className="flex-1" onClick={() => void save()}>
                <DownloadIcon size={16} />
                {t("saveGallery")}
              </Button>
              <Button size="md" variant="gray" className="flex-1" onClick={() => void share()}>
                <ShareIcon size={16} />
                {t("share")}
              </Button>
            </div>
          </motion.div>
        )}

        {(stage === "idle" || stage === "error") && (
          <Button full onClick={() => void start()}>
            {t("startExport")}
          </Button>
        )}

        <div className="rounded-[12px] bg-fill/60 px-3.5 py-3">
          <p className="text-[11.5px] leading-[1.45] text-ink2">{t("quickTestNote")}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="gray"
              disabled={quick.stage === "running"}
              onClick={() => void quickTest()}
            >
              {quick.stage === "running"
                ? t("quickTestRunning", {
                    s: ((performance.now() - quickStarted.current) / 1000).toFixed(1),
                  })
                : t("quickTest")}
            </Button>
            {quick.stage === "running" && (
              <button
                type="button"
                onClick={() => quickController.current?.abort()}
                className="text-[12px] font-medium text-danger"
              >
                {t("cancelExport")}
              </button>
            )}
          </div>
          {quick.stage === "done" && (
            <p className="mt-2 text-[12px] font-medium text-success">
              {t("quickTestDone", {
                s: (quick.ms / 1000).toFixed(1),
                size: formatBytes(quick.size),
              })}
            </p>
          )}
          {quick.stage === "error" && quick.error && (
            <p className="mt-2 text-[12px] font-medium text-danger">{quick.error}</p>
          )}
          {void quickTick}
        </div>

        <p className="text-center text-[11px] leading-[1.45] text-ink3">{t("localNote")}</p>

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none fixed inset-x-0 bottom-8 z-[80] flex justify-center"
          >
            <span className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg">
              {toast}
            </span>
          </motion.div>
        )}
      </div>
    </Sheet>
  );
}
