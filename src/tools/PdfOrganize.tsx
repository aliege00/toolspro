import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { ArrowDownIcon, ArrowUpIcon, XMark } from "@/components/Icons";
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

export default function PdfOrganize({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "application/pdf,.pdf");
  const [pageCount, setPageCount] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [invalid, setInvalid] = useState(false);
  const { status, progress, error, result, run, cancel } = useRunner();

  useEffect(() => {
    setPageCount(0);
    setOrder([]);
    setInvalid(false);
    if (!picked) return;
    let alive = true;
    void (async () => {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(await picked.file.arrayBuffer(), {
          ignoreEncryption: true,
        });
        if (!alive) return;
        const count = doc.getPageCount();
        setPageCount(count);
        setOrder(Array.from({ length: count }, (_, index) => index));
      } catch {
        if (alive) setInvalid(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [picked]);

  const move = (index: number, direction: -1 | 1) => {
    setOrder((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePage = (index: number) => {
    setOrder((prev) => prev.filter((_, i) => i !== index));
  };

  const start = () => {
    if (!picked || order.length === 0) return;
    void run("PDF Sayfaları", async (onProgress, signal) => {
      onProgress(0.08);
      const { PDFDocument } = await import("pdf-lib");
      let src;
      try {
        src = await PDFDocument.load(await picked.file.arrayBuffer(), {
          ignoreEncryption: true,
        });
      } catch {
        throw new Error(t("pdf.invalid"));
      }
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(0.3);
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(src, order);
      for (const page of pages) doc.addPage(page);
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(0.75);
      const bytes = await doc.save();
      onProgress(1);
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        name: `${picked.file.name.replace(/\.pdf$/i, "")}-sayfalar.pdf`,
      };
    });
  };

  const dirty =
    pageCount > 0 &&
    (order.length !== pageCount || order.some((page, index) => page !== index));

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
          <p className="mt-2 text-[13px] text-ink2">
            {t("pdf.pages", { n: pageCount })} · {t("pdfOrganize.kept", { n: order.length })}
          </p>
        )}
        {invalid && picked && (
          <p className="mt-2 text-[13px] text-danger">{t("pdf.invalid")}</p>
        )}
      </ToolSection>

      {order.length > 0 && (
        <ToolSection title={t("pdfOrganize.order")}>
          <div className="no-scrollbar max-h-[340px] space-y-2 overflow-y-auto">
            {order.map((page, index) => (
              <div
                key={page}
                className="flex items-center gap-2 rounded-[12px] bg-fill px-3 py-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-card text-[12.5px] font-semibold">
                  {page + 1}
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-ink2">
                  {t("pdfOrganize.position", { n: index + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink2 active:bg-card disabled:opacity-30"
                  aria-label={t("videoJoin.up")}
                >
                  <ArrowUpIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === order.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink2 active:bg-card disabled:opacity-30"
                  aria-label={t("videoJoin.down")}
                >
                  <ArrowDownIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removePage(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-danger active:bg-card"
                  aria-label={t("pdfOrganize.delete")}
                >
                  <XMark size={16} />
                </button>
              </div>
            ))}
          </div>
          {dirty && (
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOrder(Array.from({ length: pageCount }, (_, index) => index))}
              >
                {t("pdfOrganize.reset")}
              </Button>
            </div>
          )}
          <p className="mt-2 text-[12.5px] leading-[1.45] text-ink2">
            {t("pdfOrganize.note")}
          </p>
        </ToolSection>
      )}

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("pdfOrganize.run")}
        disabled={!picked || pageCount === 0 || order.length === 0 || !dirty}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
