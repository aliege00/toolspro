import { useState } from "react";
import { Segmented, Slider } from "@/components/ui";
import { formatBytes } from "@/lib/files";
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
import { assertFFmpegAlive, execFFmpeg, getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

type Height = "0" | "480" | "720" | "1080";

export default function VideoCompress({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [height, setHeight] = useState<Height>("720");
  const [crf, setCrf] = useState(23);
  const { status, progress, error, result, run, cancel } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Video Sıkıştır", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      onProgress(0.08);
      await ffmpeg.writeFile("input.mp4", await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.18);

      const args = [
        "-i", "input.mp4",
        ...(height !== "0" ? ["-vf", `scale=-2:${height}`] : []),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", String(crf),
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "output.mp4",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.2 + ratio * 0.75),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("videoCompress.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("output.mp4");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "video/mp4" }),
        name: `${base}-kucultulmus.mp4`,
      };
    });
  };

  const diff =
    result && picked
      ? Math.round((1 - result.size / picked.file.size) * 100)
      : null;

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

      <ToolSection title={t("section.settings")}>
        <div className="space-y-4">
          <Segmented
            layoutId="vcomp-height"
            value={height}
            onChange={setHeight}
            options={[
              { value: "0", label: t("videoCompress.original") },
              { value: "480", label: "480p" },
              { value: "720", label: "720p" },
              { value: "1080", label: "1080p" },
            ]}
          />
          <Slider
            label={t("videoCompress.crf")}
            display={String(crf)}
            value={crf}
            min={18}
            max={32}
            step={1}
            onChange={setCrf}
          />
          <p className="text-[12.5px] leading-[1.45] text-ink2">
            {t("videoCompress.crfNote")}
          </p>
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("videoCompress.run")}
        disabled={!picked}
        onCancel={cancel}
      />

      {result && picked && (
        <p className="text-[13px] text-ink2">
          {formatBytes(picked.file.size)} → {formatBytes(result.size)}
          {diff !== null && diff > 0
            ? ` · ${t("compress.shrunk", { p: diff })}`
            : ` · ${t("compress.notShrunk")}`}
        </p>
      )}

      {result && <OutputCard output={result} />}
    </div>
  );
}
