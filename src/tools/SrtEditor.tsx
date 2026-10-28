import { useState } from "react";
import { Button, Slider } from "@/components/ui";
import { FileIcon, XMark } from "@/components/Icons";
import { formatBytes, pickFiles, replaceExt } from "@/lib/files";
import { formatSrt, formatSrtTime, parseSrt, shiftCues } from "@/lib/srt";
import type { Cue } from "@/lib/srt";
import { OutputCard, RunArea, ToolSection, useRunner } from "./ToolFrame";
import { useT } from "@/i18n";

const MAX_CUES = 400;

export default function SrtEditor() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [shift, setShift] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const { status, progress, error, result, run, cancel } = useRunner();

  const choose = async () => {
    const files = await pickFiles({ accept: ".srt,text/plain" });
    const picked = files[0];
    if (!picked) return;
    setParseError(null);
    try {
      const parsed = parseSrt(await picked.text());
      if (parsed.cues.length === 0) throw new Error(t("srt.invalid"));
      if (parsed.cues.length > MAX_CUES) {
        throw new Error(t("srt.tooMany", { n: MAX_CUES }));
      }
      setFile(picked);
      setCues(parsed.cues);
      setShift(0);
    } catch (e) {
      setFile(null);
      setCues([]);
      setParseError(e instanceof Error ? e.message : t("srt.invalid"));
    }
  };

  const updateText = (index: number, text: string) => {
    setCues((prev) => prev.map((cue, i) => (i === index ? { ...cue, text } : cue)));
  };

  const start = () => {
    if (cues.length === 0) return;
    void run("Altyazı Düzenle", async (onProgress, signal) => {
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(0.35);
      const shifted = shiftCues(cues, shift);
      const text = formatSrt(shifted);
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(1);
      return {
        blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
        name: replaceExt(file?.name ?? "altyazi.srt", "srt").replace(/\.srt$/, "-duzenlenmis.srt"),
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        {file ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-fill p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-card text-ink2">
              <FileIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium">{file.name}</p>
              <p className="text-[12.5px] text-ink2">
                {formatBytes(file.size)} · {t("subBurn.cues", { n: cues.length })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setCues([]);
                setShift(0);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink3 active:bg-card"
              aria-label={t("common.remove")}
            >
              <XMark size={17} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void choose()}
            className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
              <FileIcon size={22} />
            </div>
            <div>
              <p className="text-[15px] font-semibold">{t("subBurn.pick")}</p>
              <p className="text-[12.5px] text-ink2">{t("srt.accept")}</p>
            </div>
          </button>
        )}
        {parseError && <p className="mt-2 text-[12.5px] text-danger">{parseError}</p>}
      </ToolSection>

      {cues.length > 0 && (
        <>
          <ToolSection title={t("srt.shift")}>
            <Slider
              label={t("srt.offset")}
              display={`${shift > 0 ? "+" : ""}${shift.toFixed(1)} s`}
              value={shift}
              min={-10}
              max={10}
              step={0.1}
              onChange={setShift}
            />
            <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("srt.note")}</p>
          </ToolSection>

          <ToolSection title={t("srt.cues")}>
            <div className="no-scrollbar max-h-[420px] space-y-2 overflow-y-auto">
              {cues.map((cue, index) => (
                <div key={index} className="rounded-[10px] bg-fill p-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink3">
                    <span>
                      {formatSrtTime(cue.start + shift)} → {formatSrtTime(cue.end + shift)}
                    </span>
                    <span>#{index + 1}</span>
                  </div>
                  <textarea
                    value={cue.text}
                    onChange={(event) => updateText(index, event.target.value)}
                    rows={2}
                    className="w-full resize-y rounded-[8px] bg-card px-2.5 py-2 text-[13.5px] leading-[1.45] outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShift(0)}>
                {t("srt.resetShift")}
              </Button>
            </div>
          </ToolSection>
        </>
      )}

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("srt.run")}
        disabled={cues.length === 0}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
