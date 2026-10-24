import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { FileIcon, PlusIcon, XMark } from "@/components/Icons";
import { formatBytes, pickFiles } from "@/lib/files";
import {
  OutputCard,
  RunArea,
  ToolSection,
  useRunner,
} from "./ToolFrame";
import { createZip } from "@/lib/media";
import { useT } from "@/i18n";

export default function ZipTool() {
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const { status, progress, error, result, run } = useRunner();

  const addFiles = async () => {
    const picked = await pickFiles({ multiple: true });
    if (picked.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
      const fresh = picked.filter(
        (f) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`),
      );
      return [...prev, ...fresh];
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const total = files.reduce((sum, f) => sum + f.size, 0);

  const start = () => {
    if (files.length === 0) return;
    void run("Arşiv (ZIP)", async (onProgress) => {
      const blob = await createZip(files, onProgress);
      const stamp = new Date().toISOString().slice(0, 10);
      return { blob, name: `medya-${stamp}.zip` };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.files")}>
        {files.length === 0 ? (
          <button
            type="button"
            onClick={() => void addFiles()}
            className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-fill text-tint">
              <PlusIcon size={22} />
            </div>
            <div>
              <p className="text-[15px] font-semibold">{t("zip.add")}</p>
              <p className="text-[12.5px] text-ink2">{t("zip.addNote")}</p>
            </div>
          </button>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {files.map((file, i) => (
                <motion.div
                  key={`${file.name}:${file.size}:${file.lastModified}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 rounded-[12px] bg-fill px-3 py-2.5"
                >
                  <FileIcon size={19} className="shrink-0 text-ink2" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{file.name}</p>
                    <p className="text-[12px] text-ink2">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-card"
                    aria-label={t("zip.remove")}
                  >
                    <XMark size={16} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            <div className="flex items-center justify-between pt-1 text-[13px]">
              <span className="text-ink2">
                {files.length} dosya · {formatBytes(total)}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void addFiles()}>
                {t("zip.addShort")}
              </Button>
            </div>
          </div>
        )}
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("zip.run")}
        disabled={files.length === 0}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
