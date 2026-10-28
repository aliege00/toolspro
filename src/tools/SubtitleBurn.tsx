import { useState } from "react";
import { Segmented, Slider } from "@/components/ui";
import { FileIcon, XMark } from "@/components/Icons";
import { Button } from "@/components/ui";
import { formatBytes, pickFiles } from "@/lib/files";
import { parseSrt } from "@/lib/srt";
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
import { assertFFmpegAlive, execFFmpeg, ffmpegExtension, getFFmpeg, mimeForExt } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

type Position = "bottom" | "top";

const MAX_CUES = 150;

export default function SubtitleBurn({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [srt, setSrt] = useState<File | null>(null);
  const [cueCount, setCueCount] = useState(0);
  const [srtError, setSrtError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>("bottom");
  const [fontSize, setFontSize] = useState(30);
  const { status, progress, error, result, run, cancel } = useRunner();

  const chooseSrt = async () => {
    const files = await pickFiles({ accept: ".srt,text/plain" });
    const file = files[0];
    if (!file) return;
    setSrtError(null);
    try {
      const parsed = parseSrt(await file.text());
      if (parsed.cues.length === 0) throw new Error(t("subBurn.invalid"));
      setSrt(file);
      setCueCount(parsed.cues.length);
    } catch (e) {
      setSrt(null);
      setCueCount(0);
      setSrtError(e instanceof Error ? e.message : t("subBurn.invalid"));
    }
  };

  const start = () => {
    if (!picked || !srt) return;
    void run("Altyazı Göm", async (onProgress, signal) => {
      const parsed = parseSrt(await srt.text());
      if (parsed.cues.length === 0) throw new Error(t("subBurn.invalid"));
      if (parsed.cues.length > MAX_CUES) {
        throw new Error(t("subBurn.tooMany", { n: MAX_CUES }));
      }

      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      onProgress(0.05);
      await ffmpeg.writeFile(`sub-in.${inputExt}`, await fetchFile(picked.file));

      const fontResponse = await fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`);
      if (!fontResponse.ok) throw new Error(t("subBurn.fontError"));
      await ffmpeg.writeFile("font.ttf", new Uint8Array(await fontResponse.arrayBuffer()));

      const filters: string[] = [];
      for (let i = 0; i < parsed.cues.length; i += 1) {
        if (signal.aborted) throw new DOMException("İptal", "AbortError");
        const cue = parsed.cues[i];
        const file = `cue-${i}.txt`;
        await ffmpeg.writeFile(file, new TextEncoder().encode(cue.text));
        const y = position === "bottom" ? "h-text_h-48" : "48";
        filters.push(
          `drawtext=fontfile=font.ttf:textfile=${file}:fontsize=${fontSize}` +
            `:fontcolor=white:borderw=2:bordercolor=black@0.9:x=(w-text_w)/2:y=${y}` +
            `:enable='between(t,${cue.start.toFixed(3)},${cue.end.toFixed(3)})'`,
        );
        if (i % 12 === 0) onProgress(0.08 + (i / parsed.cues.length) * 0.12);
      }

      assertFFmpegAlive(signal);
      onProgress(0.22);

      const args = [
        "-i", `sub-in.${inputExt}`,
        "-vf", filters.join(","),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "160k",
        "-movflags", "+faststart",
        "sub-out.mp4",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.22 + ratio * 0.72),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("subBurn.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("sub-out.mp4");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt("mp4") }),
        name: `${base}-altyazili.mp4`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <div className="space-y-3">
          <FileField
            picked={picked}
            acceptLabel={t("info.accept")}
            onChoose={() => void choose()}
            onClear={clear}
          />
          <SizeWarning bytes={picked?.file.size ?? 0} />
        </div>
      </ToolSection>

      <ToolSection title={t("subBurn.file")}>
        {srt ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-fill p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-card text-ink2">
              <FileIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium">{srt.name}</p>
              <p className="text-[12.5px] text-ink2">
                {formatBytes(srt.size)} · {t("subBurn.cues", { n: cueCount })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSrt(null);
                setCueCount(0);
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
            onClick={() => void chooseSrt()}
            className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
              <FileIcon size={22} />
            </div>
            <div>
              <p className="text-[15px] font-semibold">{t("subBurn.pick")}</p>
              <p className="text-[12.5px] text-ink2">{t("subBurn.pickNote")}</p>
            </div>
          </button>
        )}
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("subBurn.note")}</p>
        {srtError && <p className="mt-2 text-[12.5px] text-danger">{srtError}</p>}
      </ToolSection>

      <ToolSection title={t("subBurn.appearance")}>
        <Segmented
          layoutId="subburn-position"
          value={position}
          onChange={setPosition}
          options={[
            { value: "bottom", label: t("subBurn.bottom") },
            { value: "top", label: t("subBurn.top") },
          ]}
        />
        <div className="mt-4">
          <Slider
            label={t("videoWatermark.size")}
            display={`${fontSize}px`}
            value={fontSize}
            min={20}
            max={56}
            step={1}
            onChange={setFontSize}
          />
        </div>
        {!srt && picked && (
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => void chooseSrt()}>
            {t("subBurn.pick")}
          </Button>
        )}
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("subBurn.run")}
        disabled={!picked || !srt}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
