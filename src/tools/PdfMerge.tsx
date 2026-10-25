import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { FileIcon, XMark } from "@/components/Icons";
import { formatBytes, pickFiles } from "@/lib/files";
import { OutputCard, RunArea, ToolSection, useRunner } from "./ToolFrame";
import { useT } from "@/i18n";

export default function PdfMerge() {
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const { status, progress, error, result, run } = useRunner();

  const addFiles = async () => {
    const picked = await pickFiles({ multiple: true, accept: "application/pdf" });
    if (picked.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...picked.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const start = () => {
    if (files.length < 2) return;
    void run("PDF Birleştir", async (onProgress) => {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      for (let i = 0; i < files.length; i += 1) {
        try {
          const src = await PDFDocument.load(await files[i].arrayBuffer(), {
            ignoreEncryption: true,
          });
          const pages = await doc.copyPages(src, src.getPageIndices());
          for (const page of pages) doc.addPage(page);
        } catch {
          throw new Error(t("pdf.invalid"));
        }
        onProgress(((i + 1) / files.length) * 0.9);
        await new Promise((r) => setTimeout(r, 0));
      }
      const bytes = await doc.save();
      onProgress(1);
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        name: "birlestirilmis.pdf",
      };
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
              <p className="text-[12.5px] text-ink2">PDF</p>
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
                  className="flex items-center gap-3 rounded-[12px] bg-fill px-3 py-2.5"
                >
                  <span className="w-5 shrink-0 text-center text-[12px] text-ink3">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{file.name}</p>
                    <p className="text-[12px] text-ink2">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-card"
                    aria-label={t("zip.remove")}
                  >
                    <XMark size={16} />
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

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("pdf.merge")}
        disabled={files.length < 2}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
