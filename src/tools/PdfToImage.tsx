import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui";
import {
  FileField,
  OutputCard,
  RunArea,
  SizeWarning,
  ToolSection,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { useT } from "@/i18n";

type Scale = "1" | "2" | "3";
type Format = "image/png" | "image/jpeg";

const FORMAT_EXT: Record<Format, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export default function PdfToImage({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "application/pdf,.pdf");
  const [scale, setScale] = useState<Scale>("2");
  const [format, setFormat] = useState<Format>("image/png");
  const [pageCount, setPageCount] = useState(0);
  const { status, progress, error, result, run, cancel } = useRunner();

  useEffect(() => {
    setPageCount(0);
    if (!picked) return;
    let alive = true;
    void (async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(await picked.file.arrayBuffer(), {
          ignoreEncryption: true,
        });
        if (alive) setPageCount(doc.getPageCount());
      } catch {
        if (alive) setPageCount(-1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [picked]);

  const start = () => {
    if (!picked) return;
    void run("PDF → Görsel", async (onProgress, signal) => {
      onProgress(0.04);
      // Eski Android WebView'leri için legacy derleme; modern derleme
      // Promise.try / Promise.withResolvers olmadan açılmıyor.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = (
        await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;

      let doc;
      let loadingTask;
      try {
        const data = new Uint8Array(await picked.file.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data });
        doc = await loadingTask.promise;
      } catch {
        throw new Error(t("pdfToImage.error"));
      }

      const total = doc.numPages;
      if (total === 0) throw new Error(t("pdfToImage.error"));
      const files: File[] = [];
      const ext = FORMAT_EXT[format];

      try {
        for (let i = 1; i <= total; i += 1) {
          if (signal.aborted) throw new DOMException("İptal", "AbortError");
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: Number(scale) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const context = canvas.getContext("2d");
          if (!context) throw new Error(t("pdfToImage.error"));
          await page.render({ canvas, viewport }).promise;
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, format, format === "image/jpeg" ? 0.92 : undefined),
          );
          if (!blob) throw new Error(t("pdfToImage.error"));
          files.push(
            new File([blob], `sayfa-${String(i).padStart(2, "0")}.${ext}`, {
              type: format,
            }),
          );
          page.cleanup();
          onProgress(0.08 + (i / total) * 0.82);
        }
      } finally {
        void loadingTask?.destroy();
      }

      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      const base = picked.file.name.replace(/\.pdf$/i, "");

      if (files.length === 1) {
        onProgress(1);
        return { blob: files[0], name: `${base}-sayfa-1.${ext}` };
      }

      const { zip } = await import("fflate");
      const entries: Record<string, Uint8Array> = {};
      for (const file of files) {
        entries[file.name] = new Uint8Array(await file.arrayBuffer());
      }
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      const zipped = await new Promise<Uint8Array>((resolve, reject) => {
        zip(entries, { level: 5 }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      onProgress(1);
      return {
        blob: new Blob([zipped as unknown as BlobPart], { type: "application/zip" }),
        name: `${base}-sayfalar.zip`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel="PDF"
          onChoose={() => void choose()}
          onClear={clear}
        />
        <div className="mt-3">
          <SizeWarning
            bytes={picked?.file.size ?? 0}
            threshold={60 * 1024 * 1024}
            messageKey="run.largeFile"
          />
        </div>
        {pageCount > 0 && (
          <p className="mt-2 text-[13px] text-ink2">{t("pdf.pages", { n: pageCount })}</p>
        )}
        {pageCount === -1 && picked && (
          <p className="mt-2 text-[13px] text-danger">{t("pdf.invalid")}</p>
        )}
      </ToolSection>

      <ToolSection title={t("pdfToImage.quality")}>
        <Segmented
          layoutId="pdf-image-scale"
          value={scale}
          onChange={setScale}
          options={[
            { value: "1", label: "72 dpi" },
            { value: "2", label: "144 dpi" },
            { value: "3", label: "216 dpi" },
          ]}
        />
        <div className="mt-4">
          <Segmented
            layoutId="pdf-image-format"
            value={format}
            onChange={setFormat}
            options={[
              { value: "image/png", label: "PNG" },
              { value: "image/jpeg", label: "JPEG" },
            ]}
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("pdfToImage.note")}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("pdfToImage.run")}
        disabled={!picked || pageCount === 0}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
