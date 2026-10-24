import { useEffect, useState } from "react";
import { Segmented, Slider } from "@/components/ui";
import { formatDuration } from "@/lib/files";
import {
  FileField,
  OutputCard,
  RunArea,
  ToolSection,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { ffmpegExtension, getFFmpeg, mimeForExt } from "@/lib/ffmpeg";
import { readVideoMeta } from "@/lib/media";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

type Mode = "fast" | "precise";

export default function VideoTrim({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [mode, setMode] = useState<Mode>("fast");
  const { status, progress, error, result, run } = useRunner();

  useEffect(() => {
    setDuration(0);
    setStart(0);
    setEnd(0);
    if (!picked) return;
    let alive = true;
    readVideoMeta(picked.file)
      .then((meta) => {
        if (!alive) return;
        setDuration(meta.duration);
        setEnd(meta.duration);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [picked]);

  const clipLength = Math.max(0, end - start);

  const startRun = () => {
    if (!picked) return;
    void run("Video Kırp", async (onProgress) => {
      const ffmpeg = await getFFmpeg();
      onProgress(0.08);

      const ext = ffmpegExtension(picked.file.name);
      const inputName = `input.${ext}`;
      await ffmpeg.writeFile(inputName, await fetchFile(picked.file));
      onProgress(0.18);

      const outputExt = mode === "fast" ? ext : "mp4";
      const outputName = `clip.${outputExt}`;
      const length = clipLength.toFixed(3);
      const offset = start.toFixed(3);

      const args =
        mode === "fast"
          ? ["-ss", offset, "-i", inputName, "-t", length, "-c", "copy", outputName]
          : [
              "-ss", offset, "-i", inputName, "-t", length,
              "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
              "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
              outputName,
            ];

      const onProgressEvent = ({ progress: ratio }: { progress: number }) => {
        onProgress(0.2 + Math.min(1, Math.max(0, ratio)) * 0.75);
      };
      ffmpeg.on("progress", onProgressEvent);
      try {
        const code = await ffmpeg.exec(args);
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        throw new Error(t("videoTrim.error"));
      } finally {
        ffmpeg.off("progress", onProgressEvent);
      }

      const data = await ffmpeg.readFile(outputName);
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt(outputExt) }),
        name: `${base}-kip.${outputExt}`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel={t("info.accept")}
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title={t("section.range")}>
        {duration > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-ink2">{t("trim.range")}</span>
              <span className="font-semibold">
                {formatDuration(start)} → {formatDuration(end)} ·{" "}
                {formatDuration(clipLength)}
              </span>
            </div>
            <Slider
              label={t("trim.start")}
              display={formatDuration(start)}
              value={start}
              min={0}
              max={Math.max(0.1, end - 0.5)}
              step={0.1}
              onChange={setStart}
            />
            <Slider
              label={t("trim.end")}
              display={formatDuration(end)}
              value={end}
              min={Math.min(duration, start + 0.5)}
              max={duration}
              step={0.1}
              onChange={setEnd}
            />
          </div>
        ) : (
          <p className="text-[13px] text-ink2">
            {picked ? t("trim.loading") : t("trim.noFile")}
          </p>
        )}
      </ToolSection>

      <ToolSection title={t("section.format")}>
        <Segmented
          layoutId="vtrim-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "fast", label: t("videoTrim.fast") },
            { value: "precise", label: t("videoTrim.precise") },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          {t("videoTrim.note")}
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={startRun}
        runLabel={t("videoTrim.run")}
        disabled={!picked || duration <= 0 || clipLength < 0.1}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
