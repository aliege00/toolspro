import { useState } from "react";
import { Segmented } from "@/components/ui";
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
import {
  assertFFmpegAlive,
  execFFmpeg,
  getFFmpeg,
} from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

type Target = "480" | "720" | "1080" | "9:16" | "16:9" | "1:1" | "4:5";
type Mode = "fit" | "crop";

/** Hedef en-boy oranları; uzun kenar 1080 px ve katları çift sayıya yuvarlanır. */
const RATIO_TARGETS: Record<string, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};

function videoFilter(target: Target, mode: Mode): string {
  if (target === "480" || target === "720" || target === "1080") {
    return `scale=-2:${target},setsar=1`;
  }
  const [width, height] = RATIO_TARGETS[target];
  return mode === "crop"
    ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`
    : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
}

export default function VideoResize({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [target, setTarget] = useState<Target>("720");
  const [mode, setMode] = useState<Mode>("fit");
  const { status, progress, error, result, run, cancel } = useRunner();

  const ratioTarget = target in RATIO_TARGETS;

  const start = () => {
    if (!picked) return;
    void run("Video Boyutlandır", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      onProgress(0.08);
      await ffmpeg.writeFile("vres-in.mp4", await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.18);

      const args = [
        "-i",
        "vres-in.mp4",
        "-vf",
        videoFilter(target, mode),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "vres-out.mp4",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.2 + ratio * 0.75),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("videoResize.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("vres-out.mp4");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      const suffix = ratioTarget ? target.replace(":", "x") : `${target}p`;
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "video/mp4" }),
        name: `${base}-${suffix}.mp4`,
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

      <ToolSection title={t("section.settings")}>
        <div className="space-y-4">
          <Segmented
            layoutId="vresize-target"
            value={target}
            onChange={setTarget}
            options={[
              { value: "480", label: "480p" },
              { value: "720", label: "720p" },
              { value: "1080", label: "1080p" },
              { value: "9:16", label: "9:16" },
              { value: "16:9", label: "16:9" },
              { value: "1:1", label: "1:1" },
            ]}
          />
          {ratioTarget && (
            <Segmented
              layoutId="vresize-mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "fit", label: t("videoResize.fit") },
                { value: "crop", label: t("videoResize.crop") },
              ]}
            />
          )}
          <p className="text-[12.5px] leading-[1.45] text-ink2">
            {ratioTarget ? t("videoResize.ratioNote") : t("videoResize.note")}
          </p>
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("videoResize.run")}
        disabled={!picked}
        onCancel={cancel}
      />

      {result && (
        <p className="text-[13px] text-ink2">
          {picked ? `${formatBytes(picked.file.size)} → ` : ""}
          {formatBytes(result.size)}
        </p>
      )}

      {result && <OutputCard output={result} />}
    </div>
  );
}
