import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { FileIcon, XMark } from "@/components/Icons";
import { FileIcon as ImageIcon2 } from "@/components/Icons";
import { formatBytes, pickFiles } from "@/lib/files";
import { OutputCard, RunArea, ToolSection, useRunner } from "./ToolFrame";
import { processImage } from "@/lib/media";
import { useT } from "@/i18n";

export default function ImageToPdf() {
  const t = useT();
  const [files, setFiles] = useState<File[]>([]);
  const { status, progress, error, result, run } = useRunner();

  const addFiles = async () => {
    const picked = await pickFiles({ multiple: true, accept: "image/*" });
    if (picked.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...picked.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const start = () => {
    if (files.length === 0) return;
    void run("Görselleri PDF Yap", async (onProgress) => {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const type = file.type.toLowerCase();
        let bytes: ArrayBuffer;

        if (type === "image/jpeg" || type === "image/jpg" || type === "image/png") {
          bytes = await file.arrayBuffer();
        } else {
          const jpeg = await processImage(file, { quality: 0.92, type: "image/jpeg" });
          bytes = await jpeg.arrayBuffer();
        }

        const image =
          type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

        const page = doc.addPage([595.28, 841.89]);
        const margin = 24;
        const maxWidth = 595.28 - margin * 2;
        const maxHeight = 841.89 - margin * 2;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = image.width * scale;
        const height = image.height * scale;
        page.drawImage(image, {
          x: (595.28 - width) / 2,
          y: (841.89 - height) / 2,
          width,
          height,
        });

        onProgress(((i + 1) / (files.length + 1)) * 0.95);
        await new Promise((r) => setTimeout(r, 0));
      }

      const bytesOut = await doc.save();
      onProgress(1);
      return {
        blob: new Blob([bytesOut as unknown as BlobPart], { type: "application/pdf" }),
        name: "gorseller.pdf",
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("pdf.images")}>
        {files.length === 0 ? (
          <button
            type="button"
            onClick={() => void addFiles()}
            className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
              <ImageIcon2 size={22} />
            </div>
            <div>
              <p className="text-[15px] font-semibold">{t("file.pick")}</p>
              <p className="text-[12.5px] text-ink2">{t("compress.accept")}</p>
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
                  <FileIcon size={19} className="shrink-0 text-ink2" />
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

      <p className="text-[12.5px] leading-[1.45] text-ink2">{t("pdf.note")}</p>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("pdf.create")}
        disabled={files.length === 0}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
