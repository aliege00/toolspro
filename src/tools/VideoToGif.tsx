import { useState } from "react";
import { Segmented, Slider } from "@/components/ui";
import {
  FileField,
  OutputCard,
  RunArea,
  ToolSection,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { useT } from "@/i18n";

type SeekVideo = HTMLVideoElement;

function loadVideo(url: string): Promise<SeekVideo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const timer = window.setTimeout(() => reject(new Error("timeout")), 20000);
    video.onloadeddata = () => {
      window.clearTimeout(timer);
      resolve(video);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("load"));
    };
  });
}

function seekTo(video: SeekVideo, time: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener("seeked", handler);
      resolve();
    };
    video.addEventListener("seeked", handler);
    video.currentTime = time;
  });
}

export default function VideoToGif({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [fps, setFps] = useState<"5" | "10" | "15">("10");
  const [width, setWidth] = useState<"240" | "360" | "480">("360");
  const [seconds, setSeconds] = useState(3);
  const { status, progress, error, result, run } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Video → GIF", async (onProgress) => {
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      const video = await loadVideo(picked.url);
      const duration = video.duration || seconds;

      const targetWidth = Number(width);
      const scale = targetWidth / (video.videoWidth || targetWidth);
      const w = Math.max(1, Math.round((video.videoWidth || targetWidth) * scale));
      const h = Math.max(
        1,
        Math.round((video.videoHeight || Math.round(targetWidth * 0.75)) * scale),
      );

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");

      const rate = Number(fps);
      const length = Math.min(seconds, duration || seconds);
      const count = Math.max(1, Math.min(150, Math.round(length * rate)));
      const delayMs = Math.round(1000 / rate);

      const gif = GIFEncoder();

      for (let i = 0; i < count; i += 1) {
        const time = Math.min(Math.max(0, duration - 0.05), (i / rate));
        await seekTo(video, time);
        ctx.drawImage(video, 0, 0, w, h);
        const image = ctx.getImageData(0, 0, w, h);
        const palette = quantize(image.data, 256, { format: "rgb565" });
        const index = applyPalette(image.data, palette[0], "rgb565");
        gif.writeFrame(index, w, h, { palette: palette[0], delay: delayMs });
        onProgress((i + 1) / (count + 1));
        await new Promise((r) => setTimeout(r, 0));
      }

      gif.finish();
      const bytes = gif.bytes();
      video.removeAttribute("src");
      video.load();
      onProgress(1);
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: "image/gif" }),
        name: `${picked.file.name.replace(/\.[^.]+$/, "")}.gif`,
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

      <ToolSection title={t("section.settings")}>
        <div className="space-y-4">
          <Segmented
            layoutId="gif-fps"
            value={fps}
            onChange={setFps}
            options={[
              { value: "5", label: "5 FPS" },
              { value: "10", label: "10 FPS" },
              { value: "15", label: "15 FPS" },
            ]}
          />
          <Segmented
            layoutId="gif-width"
            value={width}
            onChange={setWidth}
            options={[
              { value: "240", label: "240 px" },
              { value: "360", label: "360 px" },
              { value: "480", label: "480 px" },
            ]}
          />
          <Slider
            label={t("gif.range")}
            display={`${seconds} sn`}
            value={seconds}
            min={1}
            max={10}
            step={1}
            onChange={setSeconds}
          />
          <p className="text-[12.5px] leading-[1.45] text-ink2">{t("gif.note")}</p>
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("gif.run")}
        disabled={!picked}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
