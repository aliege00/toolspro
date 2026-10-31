import { useState } from "react";
import { Segmented } from "@/components/ui";
import { formatBytes } from "@/lib/files";
import {
  FileField,
  OutputCard,
  RunArea,
  ToolSection,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { assertFFmpegAlive, execFFmpeg, getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

type Fps = "10" | "15" | "25";

export default function GifToVideo({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "image/gif,.gif");
  const [fps, setFps] = useState<Fps>("15");
  const { status, progress, error, result, run, cancel } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("GIF Videoya Çevir", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      onProgress(0.08);
      await ffmpeg.writeFile("gif-in.gif", await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.18);

      const args = [
        "-i",
        "gif-in.gif",
        "-vf",
        // Çift sayı olmayan boyutlar libx264'te sorun çıkarır; yuv420p gerekli.
        `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-movflags",
        "+faststart",
        "gif-out.mp4",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.2 + ratio * 0.75),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("gifToVideo.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("gif-out.mp4");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "video/mp4" }),
        name: `${base}.mp4`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel="GIF"
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title={t("section.settings")}>
        <div className="space-y-3">
          <Segmented
            layoutId="gif2video-fps"
            value={fps}
            onChange={setFps}
            options={[
              { value: "10", label: "10 fps" },
              { value: "15", label: "15 fps" },
              { value: "25", label: "25 fps" },
            ]}
          />
          <p className="text-[12.5px] leading-[1.45] text-ink2">
            {t("gifToVideo.note")}
          </p>
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("gifToVideo.run")}
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
