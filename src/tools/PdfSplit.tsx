import { useEffect, useState } from "react";
import { FileField, OutputCard, RunArea, ToolSection, useRunner, useToolFile } from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { useT } from "@/i18n";

function parseRanges(input: string, total: number): number[] {
  const pages = new Set<number>();
  for (const part of input.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const from = Math.min(Number(range[1]), Number(range[2]));
      const to = Math.max(Number(range[1]), Number(range[2]));
      for (let i = from; i <= to; i += 1) {
        if (i >= 1 && i <= total) pages.add(i);
      }
    } else if (/^\d+$/.test(trimmed)) {
      const page = Number(trimmed);
      if (page >= 1 && page <= total) pages.add(page);
    }
  }
  return [...pages].sort((a, b) => a - b).map((p) => p - 1);
}

export default function PdfSplit({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "application/pdf,.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [range, setRange] = useState("");
  const { status, progress, error, result, run } = useRunner();

  useEffect(() => {
    setPageCount(0);
    setRange("");
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
    void run("PDF Böl", async (onProgress) => {
      onProgress(0.1);
      const { PDFDocument } = await import("pdf-lib");
      let src;
      try {
        src = await PDFDocument.load(await picked.file.arrayBuffer(), {
          ignoreEncryption: true,
        });
      } catch {
        throw new Error(t("pdf.invalid"));
      }
      const indices = parseRanges(range, src.getPageCount());
      if (indices.length === 0) throw new Error(t("pdf.needRange"));
      onProgress(0.4);
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, indices);
      for (const page of pages) doc.addPage(page);
      onProgress(0.7);
      const bytes = await doc.save();
      onProgress(1);
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        name: `${picked.file.name.replace(/\.pdf$/i, "")}-bolum.pdf`,
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
        {pageCount > 0 && (
          <p className="mt-2 text-[13px] text-ink2">{t("pdf.pages", { n: pageCount })}</p>
        )}
        {pageCount === -1 && picked && (
          <p className="mt-2 text-[13px] text-danger">{t("pdf.invalid")}</p>
        )}
      </ToolSection>

      <ToolSection title={t("pdf.splitRange")}>
        <input
          value={range}
          onChange={(e) => setRange(e.target.value)}
          placeholder="1-3, 5"
          inputMode="numeric"
          className="h-11 w-full rounded-[12px] bg-fill px-4 text-[15px] outline-none placeholder:text-ink3"
        />
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("pdf.split")}
        disabled={!picked || pageCount <= 0 || range.trim() === ""}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
