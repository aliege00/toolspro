import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { ArrowDownIcon, ArrowUpIcon, FileIcon, XMark } from "@/components/Icons";
import { formatBytes, pickFiles } from "@/lib/files";
import {
  OutputCard,
  RunArea,
  SizeWarning,
  ToolSection,
  useRunner,
} from "./ToolFrame";
import { concatAudioBuffers, decodeToAudioBuffer, encodeMp3 } from "@/lib/media";
import { useT } from "@/i18n";

export default function AudioJoin() {
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const { status, progress, error, result, run, cancel } = useRunner();
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  const addFiles = async () => {
    const picked = await pickFiles({ multiple: true, accept: "audio/*,video/*" });
    if (picked.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...picked.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const start = () => {
    if (files.length < 2) return;
    void run("Ses Birleştir", async (onProgress, signal) => {
      const buffers: AudioBuffer[] = [];
      for (let i = 0; i < files.length; i += 1) {
        if (signal.aborted) break;
        const buffer = await decodeToAudioBuffer(files[i]);
        buffers.push(buffer);
        onProgress(0.05 + ((i + 1) / files.length) * 0.4);
      }
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      if (buffers.length < 2) throw new Error(t("audioJoin.error"));

      const joined = await concatAudioBuffers(buffers);
      const blob = await encodeMp3(joined, 192, (ratio) => onProgress(0.45 + ratio * 0.53), signal);
      onProgress(1);
      return { blob, name: "birlestirilmis-ses.mp3" };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("pdf.files")}>
        {files.length === 0 ? (
          <button
            type="button"
            onClick={() => void addFiles()}
            className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
              <FileIcon size={22} />
            </div>
            <div>
              <p className="text-[15px] font-semibold">{t("file.pick")}</p>
              <p className="text-[12.5px] text-ink2">{t("audioJoin.need2")}</p>
            </div>
          </button>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {files.map((file, i) => (
                <motion.div
                  key={`${file.name}:${file.size}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="flex items-center gap-2 rounded-[12px] bg-fill px-2.5 py-2"
                >
                  <span className="w-5 shrink-0 text-center text-[12px] text-ink3">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{file.name}</p>
                    <p className="text-[11.5px] text-ink2">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink2 active:bg-card disabled:opacity-30"
                    aria-label={t("videoJoin.up")}
                  >
                    <ArrowUpIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === files.length - 1}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink2 active:bg-card disabled:opacity-30"
                    aria-label={t("videoJoin.down")}
                  >
                    <ArrowDownIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-card"
                    aria-label={t("zip.remove")}
                  >
                    <XMark size={15} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="flex items-center justify-between pt-1 text-[13px]">
              <span className="text-ink2">{t("files.items", { n: files.length })}</span>
              <Button size="sm" variant="ghost" onClick={() => void addFiles()}>
                {t("zip.addShort")}
              </Button>
            </div>
          </div>
        )}
      </ToolSection>

      <SizeWarning bytes={totalBytes} />

      <p className="text-[12.5px] leading-[1.45] text-ink2">{t("audioJoin.note")}</p>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("audioJoin.run")}
        disabled={files.length < 2}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
