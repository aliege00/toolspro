import { useEffect, useState } from "react";
import { Segmented, Slider } from "@/components/ui";
import {
  FileField,
  OutputCard,
  RunArea,
  ToolSection,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { useT } from "@/i18n";

type Edge = "bottom" | "top";
type Align = "left" | "center" | "right";
type Format = "plain" | "ofTotal";

export default function PdfNumbering({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "application/pdf,.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [edge, setEdge] = useState<Edge>("bottom");
  const [align, setAlign] = useState<Align>("center");
  const [format, setFormat] = useState<Format>("ofTotal");
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(11);
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

  const start_ = () => {
    if (!picked) return;
    void run("PDF Sayfa Numarası", async (onProgress) => {
      onProgress(0.1);
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      let doc;
      try {
        doc = await PDFDocument.load(await picked.file.arrayBuffer(), {
          ignoreEncryption: true,
        });
      } catch {
        throw new Error(t("pdf.invalid"));
      }
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;
      const margin = 24;

      for (let i = 0; i < total; i += 1) {
        const page = pages[i];
        const number = start + i;
        const label =
          format === "ofTotal" ? `${number} / ${total}` : String(number);
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, size);
        const x =
          align === "left"
            ? margin
            : align === "right"
              ? width - margin - textWidth
              : (width - textWidth) / 2;
        const y = edge === "bottom" ? margin : height - margin - size;
        page.drawText(label, {
          x,
          y,
          size,
          font,
          color: rgb(0, 0, 0),
        });
        if (i % 5 === 0) onProgress(0.1 + (i / Math.max(1, total)) * 0.8);
      }

      onProgress(0.95);
      const bytes = await doc.save();
      onProgress(1);
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        name: `${picked.file.name.replace(/\.pdf$/i, "")}-numarali.pdf`,
      };
    });
  };

  const canRun = picked && pageCount > 0;

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <div className="space-y-3">
          <FileField
            picked={picked}
            acceptLabel="PDF"
            onChoose={() => void choose()}
            onClear={clear}
          />
          {pageCount > 0 && (
            <p className="text-[13px] text-ink2">{t("pdf.pages", { n: pageCount })}</p>
          )}
          {pageCount === -1 && picked && (
            <p className="text-[13px] text-danger">{t("pdf.invalid")}</p>
          )}
        </div>
      </ToolSection>

      <ToolSection title={t("section.settings")}>
        <div className="space-y-4">
          <Segmented
            layoutId="pdfnum-edge"
            value={edge}
            onChange={setEdge}
            options={[
              { value: "bottom", label: t("pdfNumbering.bottom") },
              { value: "top", label: t("pdfNumbering.top") },
            ]}
          />
          <Segmented
            layoutId="pdfnum-align"
            value={align}
            onChange={setAlign}
            options={[
              { value: "left", label: t("pdfNumbering.left") },
              { value: "center", label: t("pdfNumbering.center") },
              { value: "right", label: t("pdfNumbering.right") },
            ]}
          />
          <Segmented
            layoutId="pdfnum-format"
            value={format}
            onChange={setFormat}
            options={[
              { value: "ofTotal", label: t("pdfNumbering.ofTotal") },
              { value: "plain", label: t("pdfNumbering.plain") },
            ]}
          />
          <Slider
            label={t("pdfNumbering.start")}
            display={String(start)}
            value={start}
            min={1}
            max={Math.max(1, pageCount)}
            step={1}
            onChange={setStart}
          />
          <Slider
            label={t("pdfNumbering.size")}
            display={`${size} pt`}
            value={size}
            min={8}
            max={24}
            step={1}
            onChange={setSize}
          />
          <p className="text-[12.5px] leading-[1.45] text-ink2">
            {t("pdfNumbering.note")}
          </p>
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start_}
        runLabel={t("pdfNumbering.run")}
        disabled={!canRun}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
