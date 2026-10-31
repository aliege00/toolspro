import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, ProgressBar } from "@/components/ui";
import { FileIcon, MusicIcon, TrashIcon, VideoIcon } from "@/components/Icons";
import { formatBytes, pickFiles, replaceExt } from "@/lib/files";
import type { Kind } from "@/lib/files";
import { FFMPEG_WARN_BYTES, clearFFmpegFiles } from "@/lib/ffmpeg";
import { useOutputs } from "@/lib/outputs";
import type { Output } from "@/lib/outputs";
import { entryFile, useLibrary } from "@/lib/library";
import { logError } from "@/lib/errorLog";
import { saveBlob } from "@/lib/native";
import { useT } from "@/i18n";

export type ToolProps = { initialFileId?: string };

export type PickedFile = {
  file: File;
  url: string;
  fromLibraryId?: string;
};

/** Araç için dosya seçimi; kütüphanedeki bir video fileId ile önden yüklenebilir. */
export function useToolFile(initialFileId?: string, accept?: string) {
  const { byId } = useLibrary();
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const createdUrl = useRef<string | null>(null);
  const appliedInitial = useRef<string | null>(null);

  useEffect(() => {
    if (!initialFileId || appliedInitial.current === initialFileId) return;
    const entry = byId(initialFileId);
    if (!entry) return;
    appliedInitial.current = initialFileId;
    let alive = true;
    void entryFile(entry).then((file) => {
      if (alive) setPicked({ file, url: entry.url, fromLibraryId: entry.id });
    });
    return () => {
      alive = false;
    };
  }, [initialFileId, byId]);

  useEffect(
    () => () => {
      if (createdUrl.current) URL.revokeObjectURL(createdUrl.current);
    },
    [],
  );

  const choose = useCallback(
    async (multiple = false) => {
      const files = await pickFiles({ multiple, accept });
      const file = files[0];
      if (!file) return;
      if (createdUrl.current) URL.revokeObjectURL(createdUrl.current);
      const url = URL.createObjectURL(file);
      createdUrl.current = url;
      setPicked({ file, url });
    },
    [accept],
  );

  const chooseMany = useCallback(
    async (acceptOverride?: string) => {
      const files = await pickFiles({ multiple: true, accept: acceptOverride });
      return files;
    },
    [],
  );

  const clear = useCallback(() => {
    if (createdUrl.current) {
      URL.revokeObjectURL(createdUrl.current);
      createdUrl.current = null;
    }
    setPicked(null);
  }, []);

  return { picked, choose, chooseMany, clear };
}

type RunResult = { blob: Blob; name: string };

/** Uzun süren işlemlerde gösterilen hafif uyarı; işlemi engellemez. */
export function SizeWarning({
  bytes,
  threshold = FFMPEG_WARN_BYTES,
  messageKey = "run.largeFile",
}: {
  bytes: number;
  threshold?: number;
  messageKey?: string;
}) {
  const t = useT();
  if (!bytes || bytes < threshold) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[12px] bg-fill px-3.5 py-3 text-[12.5px] leading-[1.45] text-ink2"
    >
      {t(messageKey, { size: formatBytes(bytes) })}
    </motion.p>
  );
}

export function useRunner() {
  const { addOutput } = useOutputs();
  const [status, setStatus] = useState<
    "idle" | "working" | "cancelled" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Output | null>(null);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(
    async (
      tool: string,
      task: (
        onProgress: (ratio: number) => void,
        signal: AbortSignal,
      ) => Promise<RunResult>,
    ) => {
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      setStatus("working");
      setProgress(0);
      setError(null);
      setResult(null);
      try {
        const res = await task(setProgress, next.signal);
        if (next.signal.aborted) {
          setStatus("cancelled");
          return;
        }
        const output = addOutput(res.name, res.blob, tool);
        setResult(output);
        setProgress(1);
        setStatus("done");
      } catch (e) {
        if (next.signal.aborted) {
          setProgress(0);
          setStatus("cancelled");
          return;
        }
        logError(tool, e);
        setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
        setStatus("error");
      } finally {
        // Girdi/çıktı dosyaları sanal diskte kalırsa birkaç işten sonra bellek
        // dolar ve sonraki araçlar çalışmaz. Her işin ardından temizle.
        void clearFFmpegFiles();
      }
    },
    [addOutput],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setStatus("idle");
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return { status, progress, error, result, run, reset, cancel };
}

export function ToolSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
        {title}
      </h2>
      <div className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </section>
  );
}

export function FileField({
  picked,
  acceptLabel,
  onChoose,
  onClear,
  multipleCount,
}: {
  picked: { file: File; url: string } | null;
  acceptLabel: string;
  onChoose: () => void;
  onClear: () => void;
  multipleCount?: number;
}) {
  const t = useT();
  return (
    <AnimatePresence mode="wait" initial={false}>
      {picked || multipleCount ? (
        <motion.div
          key="picked"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 rounded-[14px] bg-fill p-3"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-card text-ink2">
            <FileIcon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-medium">
              {multipleCount
                ? t("file.pickedCount", { n: multipleCount })
                : picked?.file.name}
            </p>
            <p className="text-[12.5px] text-ink2">
              {multipleCount ? t("file.pickedNote") : formatBytes(picked!.file.size)}
            </p>
          </div>
          <Button size="sm" variant="gray" onClick={onChoose}>
            {t("common.change")}
          </Button>
          <button
            type="button"
            onClick={onClear}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink3 active:bg-card"
            aria-label={t("common.remove")}
          >
            <TrashIcon size={17} />
          </button>
        </motion.div>
      ) : (
        <motion.button
          key="empty"
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.98 }}
          onClick={onChoose}
          className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
            <FileIcon size={22} />
          </div>
          <div>
            <p className="text-[15px] font-semibold">{t("file.pick")}</p>
            <p className="text-[12.5px] text-ink2">{acceptLabel}</p>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function RunArea({
  status,
  progress,
  error,
  onRun,
  runLabel,
  disabled,
  onCancel,
}: {
  status: "idle" | "working" | "cancelled" | "done" | "error";
  progress: number;
  error: string | null;
  onRun: () => void;
  runLabel: string;
  disabled: boolean;
  onCancel?: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Button
        full
        loading={status === "working"}
        disabled={disabled || status === "working"}
        onClick={onRun}
      >
        {runLabel}
      </Button>
      {status === "working" && (
        <div className="space-y-2">
          <ProgressBar ratio={progress} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink2">
              {t("run.working", { p: Math.round(progress * 100) })}
            </p>
            {onCancel && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={onCancel}
                className="rounded-full bg-fill px-3.5 py-1.5 text-[13px] font-medium text-ink"
              >
                {t("run.cancel")}
              </motion.button>
            )}
          </div>
        </div>
      )}
      <AnimatePresence>
        {status === "cancelled" && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-[13px] text-ink2"
          >
            {t("run.cancelled")}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {status === "error" && error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-[12px] bg-danger/10 px-3.5 py-3 text-[13px] leading-[1.45] text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const kindIcons: Record<Kind, React.ReactNode> = {
  video: <VideoIcon size={22} />,
  audio: <MusicIcon size={22} />,
  image: <FileIcon size={22} />,
  other: <FileIcon size={22} />,
};

export function OutputCard({ output }: { output: Output }) {
  const t = useT();
  const { removeOutput } = useOutputs();
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "downloaded" | "failed"
  >("idle");

  const save = async () => {
    setSaveState("saving");
    const result = await saveBlob(output.blob, output.name);
    setSaveState(result === "shared" ? "saved" : result === "downloaded" ? "downloaded" : "failed");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
          {kindIcons[output.kind]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold">{output.name}</p>
          <p className="text-[12.5px] text-ink2">{formatBytes(output.size)}</p>
        </div>
      </div>

      {output.kind === "image" && (
        <img
          src={output.url}
          alt={output.name}
          className="mt-3 max-h-56 w-full rounded-[12px] object-contain"
        />
      )}
      {output.kind === "audio" && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={output.url} controls className="mt-3 w-full" />
      )}
      {output.kind === "video" && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={output.url} controls playsInline className="mt-3 w-full rounded-[12px] bg-black" />
      )}
      {output.kind === "other" && (
        <p className="mt-3 rounded-[12px] bg-fill px-3.5 py-3 text-[13px] leading-[1.45] text-ink2">
          {output.name.endsWith(".zip")
            ? t("output.zipReady")
            : t("output.ready")}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="secondary" loading={saveState === "saving"} onClick={save}>
          {output.kind === "image" || output.kind === "audio" || output.kind === "video"
            ? t("output.save")
            : t("output.saveShort")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => removeOutput(output.id)}>
          {t("common.remove")}
        </Button>
      </div>

      <AnimatePresence>
        {saveState !== "idle" && saveState !== "saving" && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-2 text-[12.5px] ${
              saveState === "failed" ? "text-danger" : "text-ink2"
            }`}
          >
            {saveState === "saved" && t("output.saved")}
            {saveState === "downloaded" && t("output.downloaded")}
            {saveState === "failed" && t("output.saveFailed")}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export { replaceExt };
