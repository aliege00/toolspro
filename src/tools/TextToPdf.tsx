import { useState } from "react";
import { Segmented, Button } from "@/components/ui";
import { rgb } from "pdf-lib";
import { OutputCard, RunArea, ToolSection, useRunner } from "./ToolFrame";
import { createPdfDoc, prepareText, wrapText } from "@/lib/pdf";
import { pickFiles } from "@/lib/files";
import { useT } from "@/i18n";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;

export default function TextToPdf() {
  const t = useT();
  const [text, setText] = useState("");
  const [size, setSize] = useState<"10" | "12" | "16">("12");
  const [fileName, setFileName] = useState<string | null>(null);
  const { status, progress, error, result, run } = useRunner();

  const loadFile = async () => {
    const files = await pickFiles({ accept: ".txt,.md,.csv,.log,text/plain" });
    const file = files[0];
    if (!file) return;
    setText(await file.text());
    setFileName(file.name);
  };

  const start = () => {
    if (text.trim().length === 0) return;
    void run("Metin → PDF", async (onProgress) => {
      const { doc, fonts } = await createPdfDoc();
      onProgress(0.2);
      const fontSize = Number(size);
      const lineHeight = fontSize * 1.5;
      const maxWidth = PAGE.width - MARGIN * 2;
      const usableHeight = PAGE.height - MARGIN * 2;
      const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));

      const prepared = prepareText(text, fonts);
      const lines = wrapText(prepared, fonts.regular, fontSize, maxWidth);
      onProgress(0.5);

      let page = doc.addPage([PAGE.width, PAGE.height]);
      let drawn = 0;
      for (let index = 0; index < lines.length; index += 1) {
        if (drawn >= linesPerPage) {
          page = doc.addPage([PAGE.width, PAGE.height]);
          drawn = 0;
        }
        const line = lines[index];
        if (line) {
          page.drawText(line, {
            x: MARGIN,
            y: PAGE.height - MARGIN - drawn * lineHeight - fontSize,
            size: fontSize,
            font: fonts.regular,
            color: rgb(0, 0, 0),
          });
        }
        drawn += 1;
        if (index % 200 === 0) {
          onProgress(0.5 + (index / Math.max(1, lines.length)) * 0.45);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const bytes = await doc.save();
      onProgress(1);
      const base = fileName ? fileName.replace(/\.[^.]+$/, "") : "metin";
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
        name: `${base}.pdf`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("textPdf.text")}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("textPdf.placeholder")}
          rows={8}
          className="w-full resize-y rounded-[12px] bg-fill px-3.5 py-3 text-[14.5px] leading-[1.5] text-ink outline-none placeholder:text-ink3"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[12.5px] text-ink2">
            {t("textPdf.chars", { n: text.length })}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="gray" onClick={() => void loadFile()}>
              {t("textPdf.load")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setFileName(null); }}>
              {t("common.clear")}
            </Button>
          </div>
        </div>
        {fileName && (
          <p className="mt-2 truncate text-[12.5px] text-ink2">{fileName}</p>
        )}
      </ToolSection>

      <ToolSection title={t("textPdf.fontSize")}>
        <Segmented
          layoutId="text-pdf-size"
          value={size}
          onChange={setSize}
          options={[
            { value: "10", label: "10 pt" },
            { value: "12", label: "12 pt" },
            { value: "16", label: "16 pt" },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("textPdf.note")}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("textPdf.run")}
        disabled={text.trim().length === 0}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
