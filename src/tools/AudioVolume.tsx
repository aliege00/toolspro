import { useState } from "react";
import { Slider, Toggle } from "@/components/ui";
import { formatBytes } from "@/lib/files";
import {
  FileField,
  OutputCard,
  RunArea,
  SizeWarning,
  ToolSection,
  replaceExt,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import {
  assertFFmpegAlive,
  execFFmpeg,
  ffmpegExtension,
  getFFmpeg,
} from "@/lib/ffmpeg";
import { decodeToAudioBuffer, encodeMp3 } from "@/lib/media";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

const ACCEPT = "audio/*,video/*";

export default function AudioVolume({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, ACCEPT);
  const [gain, setGain] = useState(100);
  const [normalize, setNormalize] = useState(false);
  const { status, progress, error, result, run, cancel } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Ses Seviyesi", async (onProgress, signal) => {
      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      onProgress(0.06);
      await ffmpeg.writeFile(`vol-in.${inputExt}`, await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.16);

      // Kazanç önce uygulanır; normalizasyon istenirse son seviye buna göre ayarlanır.
      const filters = [`volume=${(gain / 100).toFixed(2)}`];
      if (normalize) filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");

      const args = [
        "-i",
        `vol-in.${inputExt}`,
        "-af",
        filters.join(","),
        "-vn",
        "-c:a",
        "pcm_s16le",
        "-ar",
        "44100",
        "vol-out.wav",
      ];

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.18 + ratio * 0.5),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("audioVolume.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile("vol-out.wav");
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      const wav = new File([bytes as unknown as BlobPart], "level.wav", {
        type: "audio/wav",
      });

      const buffer = await decodeToAudioBuffer(wav);
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(0.72);

      const blob = await encodeMp3(
        buffer,
        192,
        (ratio) => onProgress(0.72 + ratio * 0.28),
        signal,
      );
      return {
        blob,
        name: replaceExt(picked.file.name, "mp3"),
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
          <Slider
            label={t("audioVolume.gain")}
            display={`%${gain}`}
            value={gain}
            min={0}
            max={300}
            step={5}
            onChange={setGain}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink2">{t("audioVolume.normalize")}</span>
            <Toggle
              checked={normalize}
              onChange={setNormalize}
              label={t("audioVolume.normalize")}
            />
          </div>
          <p className="text-[12.5px] leading-[1.45] text-ink2">
            {t("audioVolume.note")}
          </p>
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("audioVolume.run")}
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
