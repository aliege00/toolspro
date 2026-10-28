import { useState } from "react";
import { Segmented, Slider } from "@/components/ui";
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

type Position = "tl" | "tr" | "bl" | "br" | "center";
type Color = "white" | "black";

const positionExpr: Record<Position, string> = {
  tl: "x=24:y=24",
  tr: "x=w-text_w-24:y=24",
  bl: "x=24:y=h-text_h-24",
  br: "x=w-text_w-24:y=h-text_h-24",
  center: "x=(w-text_w)/2:y=(h-text_h)/2",
};

export default function VideoWatermark({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [text, setText] = useState("");
  const [size, setSize] = useState(36);
  const [opacity, setOpacity] = useState(85);
  const [color, setColor] = useState<Color>("white");
  const [position, setPosition] = useState<Position>("br");
  const { status, progress, error, result, run, cancel } = useRunner();

  const start = () => {
    if (!picked) return;
    const label = text.trim();
    if (!label) return;

    void run("Filigran", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      onProgress(0.05);

      await ffmpeg.writeFile(`wm-in.${inputExt}`, await fetchFile(picked.file));
      const fontResponse = await fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`);
      if (!fontResponse.ok) throw new Error(t("videoWatermark.fontError"));
      await ffmpeg.writeFile("font.ttf", new Uint8Array(await fontResponse.arrayBuffer()));
      await ffmpeg.writeFile("watermark.txt", new TextEncoder().encode(label));
      assertFFmpegAlive(signal);
      onProgress(0.18);

      const colorExpr =
        color === "white"
          ? `white@${(opacity / 100).toFixed(2)}`
          : `black@${(opacity / 100).toFixed(2)}`;
      const boxColor = color === "white" ? "black@0.35" : "white@0.35";
      const draw =
        `drawtext=fontfile=font.ttf:textfile=watermark.txt:fontsize=${size}` +
        `:fontcolor=${colorExpr}:${positionExpr[position]}` +
        `:box=1:boxcolor=${boxColor}:boxborderw=10`;

      const args = [
        "-i", `wm-in.${inputExt}`,
        "-vf", draw,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "160k",
        "-movflags", "+faststart",
        "wm-out.mp4",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.2 + ratio * 0.74),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("videoWatermark.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("wm-out.mp4");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt("mp4") }),
        name: `${base}-filigran.mp4`,
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

      <ToolSection title={t("videoWatermark.text")}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 80))}
          placeholder={t("videoWatermark.placeholder")}
          className="h-11 w-full rounded-[12px] bg-fill px-4 text-[15px] outline-none placeholder:text-ink3"
        />
        <div className="mt-4 space-y-4">
          <Slider
            label={t("videoWatermark.size")}
            display={`${size}px`}
            value={size}
            min={16}
            max={96}
            step={1}
            onChange={setSize}
          />
          <Slider
            label={t("videoWatermark.opacity")}
            display={`${opacity}%`}
            value={opacity}
            min={20}
            max={100}
            step={5}
            onChange={setOpacity}
          />
        </div>
      </ToolSection>

      <ToolSection title={t("videoWatermark.appearance")}>
        <Segmented
          layoutId="wm-color"
          value={color}
          onChange={setColor}
          options={[
            { value: "white", label: t("videoWatermark.white") },
            { value: "black", label: t("videoWatermark.black") },
          ]}
        />
        <div className="mt-4">
          <Segmented
            layoutId="wm-position"
            value={position}
            onChange={setPosition}
            options={[
              { value: "tl", label: "↖" },
              { value: "tr", label: "↗" },
              { value: "center", label: t("videoWatermark.center") },
              { value: "bl", label: "↙" },
              { value: "br", label: "↘" },
            ]}
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          {t("videoWatermark.note")}
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("videoWatermark.run")}
        disabled={!picked || text.trim() === ""}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
