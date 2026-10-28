import {
  FileField,
  OutputCard,
  RunArea,
  ToolSection,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { rgb } from "pdf-lib";
import { parsePptx } from "@/lib/pptx";
import type { PptxDeck, PptxParagraph } from "@/lib/pptx";
import { createPdfDoc, imageToPng, prepareText } from "@/lib/pdf";
import type { PdfFonts } from "@/lib/pdf";
import { useT } from "@/i18n";

type Word = { text: string; size: number; bold: boolean; color: string | null };
type Line = { words: Word[]; width: number; height: number };
type LaidParagraph = { lines: Line[]; align: PptxParagraph["align"] };

const MAX_PARAGRAPH_GAP = 8;

function widthOf(font: { widthOfTextAtSize: (t: string, s: number) => number }, text: string, size: number) {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.55;
  }
}

/** Stil farkı olan koşuları kelime kelime bölüp satır satır dizer. */
function layoutParagraphs(
  paragraphs: PptxParagraph[],
  fonts: PdfFonts,
  maxWidth: number,
): LaidParagraph[] {
  return paragraphs.map((paragraph) => {
    const words: Word[] = [];
    for (const run of paragraph.runs) {
      const content = prepareText(run.text, fonts);
      const style = { size: run.size, bold: run.bold, color: run.color };
      const segments = content.split(/(\n)/);
      for (const segment of segments) {
        if (!segment) continue;
        if (segment === "\n") {
          words.push({ text: "\n", ...style });
          continue;
        }
        for (const piece of segment.split(/\s+/)) {
          if (piece) words.push({ text: piece, ...style });
        }
      }
    }

    const lines: Line[] = [];
    let current: Word[] = [];
    let currentWidth = 0;

    const flush = () => {
      if (current.length === 0) return;
      const height = Math.max(...current.map((word) => word.size)) * 1.34;
      lines.push({ words: current, width: currentWidth, height });
      current = [];
      currentWidth = 0;
    };

    for (const word of words) {
      if (word.text === "\n") {
        flush();
        if (current.length === 0) {
          lines.push({ words: [], width: 0, height: word.size * 1.34 });
        }
        continue;
      }
      const font = word.bold ? fonts.bold : fonts.regular;
      const wordWidth = widthOf(font, word.text, word.size);
      const gap = current.length > 0 ? widthOf(fonts.regular, " ", word.size) : 0;
      if (current.length > 0 && currentWidth + gap + wordWidth > maxWidth) {
        flush();
      } else if (current.length > 0) {
        currentWidth += gap;
      }
      current.push(word);
      currentWidth += wordWidth;
    }
    flush();

    return {
      lines: lines.length > 0 ? lines : [{ words: [], width: 0, height: 20 }],
      align: paragraph.align,
    };
  });
}

function paragraphHeight(laid: LaidParagraph): number {
  return (
    laid.lines.reduce((sum, line) => sum + line.height, 0) + MAX_PARAGRAPH_GAP
  );
}

/** PPTX hex rengini PDF rengine çevirir; okunamazsa siyah. */
function hexColor(value: string | null) {
  if (!value) return rgb(0, 0, 0);
  const hex = value.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const parsed = Number.parseInt(full, 16);
  if (!Number.isFinite(parsed) || full.length !== 6) return rgb(0, 0, 0);
  return rgb(
    ((parsed >> 16) & 255) / 255,
    ((parsed >> 8) & 255) / 255,
    (parsed & 255) / 255,
  );
}

export default function PptxToPdf({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(
    initialFileId,
    ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  const { status, progress, error, result, run } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("PPTX → PDF", async (onProgress, signal) => {
      let deck: PptxDeck;
      try {
        deck = await parsePptx(picked.file, (ratio) => onProgress(ratio * 0.3));
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (message === "PPTX_SLIDE_YOK") throw new Error(t("pptx.noSlides"));
        throw new Error(t("pptx.invalid"));
      }
      if (signal.aborted) throw new Error("aborted");

      const { doc, fonts } = await createPdfDoc();
      const pageHeight = deck.height;
      const pageWidth = deck.width;

      for (let index = 0; index < deck.slides.length; index += 1) {
        if (signal.aborted) throw new Error("aborted");
        const slide = deck.slides[index];
        const page = doc.addPage([pageWidth, pageHeight]);

        for (const item of slide.items) {
          if (item.kind === "image") {
            try {
              const png = await imageToPng(item.bytes, item.mime);
              if (!png) continue;
              const image = await doc.embedPng(png as unknown as Uint8Array);
              page.drawImage(image, {
                x: item.x,
                y: pageHeight - item.y - item.h,
                width: item.w,
                height: item.h,
              });
            } catch {
              // Desteklenmeyen görsel atlanır.
            }
            continue;
          }

          const laid = layoutParagraphs(item.paragraphs, fonts, item.w);
          const totalHeight = laid.reduce((sum, paragraph) => sum + paragraphHeight(paragraph), 0);
          let top =
            item.anchor === "middle"
              ? item.y + (item.h - totalHeight) / 2
              : item.anchor === "bottom"
                ? item.y + item.h - totalHeight
                : item.y;
          top = Math.max(0, top);

          let cursor = top;
          for (const paragraph of laid) {
            for (const line of paragraph.lines) {
              const offset =
                paragraph.align === "center"
                  ? (item.w - line.width) / 2
                  : paragraph.align === "right"
                    ? item.w - line.width
                    : 0;
              let x = item.x + Math.max(0, offset);
              const baseline = cursor + line.height * 0.78;
              for (const word of line.words) {
                const font = word.bold ? fonts.bold : fonts.regular;
                page.drawText(word.text, {
                  x,
                  y: pageHeight - baseline,
                  size: word.size,
                  font,
                  color: hexColor(word.color),
                });
                x += widthOf(font, word.text, word.size) +
                  widthOf(fonts.regular, " ", word.size);
              }
              cursor += line.height;
            }
            cursor += MAX_PARAGRAPH_GAP;
          }
        }

        onProgress(0.4 + ((index + 1) / deck.slides.length) * 0.55);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const bytes = await doc.save();
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        name: `${base}.pdf`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel={t("pptx.accept")}
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <p className="text-[12.5px] leading-[1.45] text-ink2">{t("pptx.note")}</p>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("pptx.run")}
        disabled={!picked}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
