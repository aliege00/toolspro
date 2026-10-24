import { useMemo, useState } from "react";
import { Segmented, Toggle } from "@/components/ui";
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
import { useT } from "@/i18n";

type Rotation = "0" | "90" | "180" | "270";

export default function VideoRotate({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [rotation, setRotation] = useState<Rotation>("90");
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const { status, progress, error, result, run, cancel } = useRunner();

  const filters = useMemo(() => {
    const parts: string[] = [];
    if (rotation === "90") parts.push("transpose=1");
    if (rotation === "270") parts.push("transpose=2");
    if (rotation === "180") parts.push("hflip", "vflip");
    if (flipH) parts.push("hflip");
    if (flipV) parts.push("vflip");
    return parts;
  }, [rotation, flipH, flipV]);

  const changed = filters.length > 0;

  const start = () => {
    if (!picked || !changed) return;
    void run("Video Döndür", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      onProgress(0.06);
      await ffmpeg.writeFile(`rotate-in.${inputExt}`, await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.16);

      const args = [
        "-i", `rotate-in.${inputExt}`,
        "-vf", filters.join(","),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "160k",
        "-movflags", "+faststart",
        "rotate-out.mp4",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.18 + ratio * 0.76),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("videoRotate.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("rotate-out.mp4");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt("mp4") }),
        name: `${base}-dondurulmus.mp4`,
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
          {picked && (
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-[12px] bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={picked.url}
                muted
                playsInline
                preload="metadata"
                className="max-h-full max-w-full object-contain transition-transform duration-300"
                style={{
                  transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  maxWidth: rotation === "90" || rotation === "270" ? "58%" : "100%",
                }}
              />
            </div>
          )}
        </div>
      </ToolSection>

      <ToolSection title={t("videoRotate.rotation")}>
        <Segmented
          layoutId="vrotate-angle"
          value={rotation}
          onChange={setRotation}
          options={[
            { value: "0", label: "0°" },
            { value: "90", label: "90°" },
            { value: "180", label: "180°" },
            { value: "270", label: "270°" },
          ]}
        />
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[15px]">{t("videoRotate.flipH")}</span>
            <Toggle checked={flipH} onChange={setFlipH} label={t("videoRotate.flipH")} />
          </div>
          <div className="flex items-center justify-between border-t border-line py-1.5">
            <span className="text-[15px]">{t("videoRotate.flipV")}</span>
            <Toggle checked={flipV} onChange={setFlipV} label={t("videoRotate.flipV")} />
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          {t("videoRotate.note")}
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("videoRotate.run")}
        disabled={!picked || !changed}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
