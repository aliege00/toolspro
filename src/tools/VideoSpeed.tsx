import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  ffmpegExtension,
  getFFmpeg,
  mimeForExt,
} from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { readVideoMeta } from "@/lib/media";
import { formatDuration } from "@/lib/files";
import { useT } from "@/i18n";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

/** atempo 0.5–2 aralığı dışında kabul etmez; zincirle. */
function atempoChain(speed: number): string {
  const parts: string[] = [];
  let value = speed;
  while (value > 2) {
    parts.push("atempo=2");
    value /= 2;
  }
  while (value < 0.5) {
    parts.push("atempo=0.5");
    value /= 0.5;
  }
  if (Math.abs(value - 1) > 0.001) parts.push(`atempo=${Number(value.toFixed(3))}`);
  return parts.join(",");
}

export default function VideoSpeed({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [speed, setSpeed] = useState<number>(1);
  const [duration, setDuration] = useState<number | null>(null);
  const { status, progress, error, result, run, cancel } = useRunner();

  useEffect(() => {
    let alive = true;
    setDuration(null);
    if (!picked) return;
    readVideoMeta(picked.file)
      .then((meta) => {
        if (alive) setDuration(meta.duration);
      })
      .catch(() => {
        if (alive) setDuration(null);
      });
    return () => {
      alive = false;
    };
  }, [picked]);

  const changed = speed !== 1;

  const start = () => {
    if (!picked || !changed) return;
    void run("Video Hız", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      onProgress(0.06);
      await ffmpeg.writeFile(`speed-in.${inputExt}`, await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.16);

      const videoArgs = ["-vf", `setpts=PTS/${speed}`];
      const audioFilter = atempoChain(speed);
      const outputArgs = [
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "160k",
        "-movflags", "+faststart",
        "speed-out.mp4",
      ];

      const progressArgs = {
        signal,
        onProgress: (ratio: number) => onProgress(0.18 + ratio * 0.76),
      };

      // Önce sesli dene; ses izi olmayan dosyalarda ffmpeg sıfırla döner,
      // o zaman ses filtresi olmadan yeniden kodlanır.
      let code = await execFFmpeg(
        ffmpeg,
        ["-y", "-i", `speed-in.${inputExt}`, ...videoArgs, "-af", audioFilter, ...outputArgs],
        progressArgs,
      );
      if (code !== 0 && !signal.aborted) {
        code = await execFFmpeg(
          ffmpeg,
          ["-y", "-i", `speed-in.${inputExt}`, ...videoArgs, ...outputArgs],
          progressArgs,
        );
      }
      if (code !== 0) throw new Error(t("videoSpeed.error"));

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("speed-out.mp4");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt("mp4") }),
        name: `${base}-${String(speed).replace(".", "_")}x.mp4`,
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

      <ToolSection title={t("videoSpeed.speed")}>
        <div className="grid grid-cols-4 gap-2">
          {SPEEDS.map((value) => {
            const active = value === speed;
            return (
              <motion.button
                key={value}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => setSpeed(value)}
                className={`h-11 rounded-[12px] text-[14.5px] font-medium transition-colors ${
                  active ? "bg-tint text-white" : "bg-fill text-ink active:opacity-70"
                }`}
              >
                {value}x
              </motion.button>
            );
          })}
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          {duration !== null
            ? t("videoSpeed.duration", {
                from: formatDuration(duration),
                to: formatDuration(duration / speed),
              })
            : t("videoSpeed.note")}
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("videoSpeed.run")}
        disabled={!picked || !changed}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
