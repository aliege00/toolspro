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
import { extOf } from "@/lib/files";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

const COPYABLE = ["mp4", "m4v", "mov", "mkv", "webm"];

export default function VideoMute({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const { status, progress, error, result, run, cancel } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Sesi Kaldır", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      const sourceExt = extOf(picked.file.name);
      const copyVideo = COPYABLE.includes(sourceExt);
      const outputExt = copyVideo ? sourceExt : "mp4";

      onProgress(0.06);
      await ffmpeg.writeFile(`mute-in.${inputExt}`, await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.16);

      const args = copyVideo
        ? ["-i", `mute-in.${inputExt}`, "-map", "0:v:0", "-c:v", "copy", "-an", `mute-out.${outputExt}`]
        : [
            "-i", `mute-in.${inputExt}`,
            "-map", "0:v:0",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "20",
            "-an",
            "-movflags", "+faststart",
            `mute-out.${outputExt}`,
          ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.18 + ratio * 0.76),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("videoMute.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile(`mute-out.${outputExt}`);
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt(outputExt) }),
        name: `${base}-sessiz.${outputExt}`,
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

      <p className="text-[12.5px] leading-[1.5] text-ink2">{t("videoMute.note")}</p>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("videoMute.run")}
        disabled={!picked}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
