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

type Speed = "0.5" | "0.75" | "1" | "1.5" | "2";

/** atempo 0.5–2.0 aralığında çalışır; daha uç değerler zincirlenir. */
export function atempoChain(speed: number): string[] {
  const chain: string[] = [];
  let value = speed;
  while (value < 0.5) {
    chain.push("atempo=0.5");
    value /= 0.5;
  }
  while (value > 2) {
    chain.push("atempo=2.0");
    value /= 2;
  }
  chain.push(`atempo=${value.toFixed(4)}`);
  return chain;
}

export default function AudioSpeed({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "audio/*,video/*");
  const [speed, setSpeed] = useState<Speed>("1");
  const [gain, setGain] = useState(0);
  const { status, progress, error, result, run, cancel } = useRunner();

  const changed = Number(speed) !== 1 || gain !== 0;

  const start = () => {
    if (!picked || !changed) return;
    void run("Ses Hızı", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      onProgress(0.06);
      await ffmpeg.writeFile(`aspeed-in.${inputExt}`, await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.16);

      const filters = [...atempoChain(Number(speed))];
      if (gain !== 0) filters.push(`volume=${gain}dB`);

      const args = [
        "-i", `aspeed-in.${inputExt}`,
        "-vn",
        "-filter:a", filters.join(","),
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        "aspeed-out.mp3",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.18 + ratio * 0.78),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("audioSpeed.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("aspeed-out.mp3");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt("mp3") }),
        name: `${base}-${speed}x.mp3`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <div className="space-y-3">
          <FileField
            picked={picked}
            acceptLabel={t("audioConvert.accept")}
            onChoose={() => void choose()}
            onClear={clear}
          />
          <SizeWarning bytes={picked?.file.size ?? 0} />
        </div>
      </ToolSection>

      <ToolSection title={t("audioSpeed.speed")}>
        <Segmented
          layoutId="aspeed-speed"
          value={speed}
          onChange={setSpeed}
          options={[
            { value: "0.5", label: "0.5x" },
            { value: "0.75", label: "0.75x" },
            { value: "1", label: "1x" },
            { value: "1.5", label: "1.5x" },
            { value: "2", label: "2x" },
          ]}
        />
        <div className="mt-4">
          <Slider
            label={t("audioSpeed.volume")}
            display={`${gain > 0 ? "+" : ""}${gain} dB`}
            value={gain}
            min={-20}
            max={20}
            step={1}
            onChange={setGain}
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("audioSpeed.note")}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("audioSpeed.run")}
        disabled={!picked || !changed}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
