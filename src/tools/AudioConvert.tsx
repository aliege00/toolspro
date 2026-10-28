import { useState } from "react";
import { Segmented } from "@/components/ui";
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
import { decodeToAudioBuffer, encodeMp3, encodeWav } from "@/lib/media";
import {
  assertFFmpegAlive,
  execFFmpeg,
  ffmpegExtension,
  getFFmpeg,
  mimeForExt,
} from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useT } from "@/i18n";

type Format = "mp3" | "wav" | "m4a" | "ogg" | "flac";
type Kbps = "128" | "192" | "256" | "320";

const NOTE_KEY: Record<Format, string> = {
  mp3: "audioConvert.mp3Note",
  wav: "audioConvert.wavNote",
  m4a: "audioConvert.m4aNote",
  ogg: "audioConvert.oggNote",
  flac: "audioConvert.flacNote",
};

const ACCEPT = "video/*,audio/*";

export default function AudioConvert({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, ACCEPT);
  const [format, setFormat] = useState<Format>("mp3");
  const [kbps, setKbps] = useState<Kbps>("192");
  const { status, progress, error, result, run, cancel } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Ses Dönüştür", async (onProgress, signal) => {
      if (format === "mp3" || format === "wav") {
        const buffer = await decodeToAudioBuffer(picked.file);
        if (signal.aborted) throw new DOMException("İptal", "AbortError");
        onProgress(0.15);

        if (format === "wav") {
          const blob = encodeWav(buffer);
          onProgress(1);
          return { blob, name: replaceExt(picked.file.name, "wav") };
        }

        const blob = await encodeMp3(
          buffer,
          Number(kbps),
          (ratio) => onProgress(0.15 + ratio * 0.85),
          signal,
        );
        return { blob, name: replaceExt(picked.file.name, "mp3") };
      }

      const ffmpeg = await getFFmpeg();
      const inputExt = ffmpegExtension(picked.file.name);
      onProgress(0.06);
      await ffmpeg.writeFile(`aconv-in.${inputExt}`, await fetchFile(picked.file));
      assertFFmpegAlive(signal);
      onProgress(0.16);

      const args = ["-i", `aconv-in.${inputExt}`, "-vn"];
      if (format === "m4a") {
        const rate = kbps === "320" ? "256" : kbps;
        args.push("-c:a", "aac", "-b:a", `${rate}k`, "-movflags", "+faststart");
      } else if (format === "ogg") {
        args.push("-c:a", "libvorbis", "-q:a", "5");
      } else {
        args.push("-c:a", "flac");
      }
      args.push(`aconv-out.${format}`);

      try {
        const code = await execFFmpeg(ffmpeg, args, {
          signal,
          onProgress: (ratio) => onProgress(0.18 + ratio * 0.78),
        });
        if (code !== 0) throw new Error(`ffmpeg exit ${code}`);
      } catch (e) {
        if (signal.aborted) throw e;
        throw new Error(t("audioConvert.error"));
      }

      assertFFmpegAlive(signal);
      const data = await ffmpeg.readFile(`aconv-out.${format}`);
      const bytes =
        data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
      onProgress(1);
      return {
        blob: new Blob([bytes as unknown as BlobPart], { type: mimeForExt(format) }),
        name: replaceExt(picked.file.name, format),
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

      <ToolSection title={t("audioConvert.format")}>
        <Segmented
          layoutId="audio-format"
          value={format}
          onChange={(next: Format) => setFormat(next)}
          options={[
            { value: "mp3", label: "MP3" },
            { value: "wav", label: "WAV" },
            { value: "m4a", label: "M4A" },
            { value: "ogg", label: "OGG" },
            { value: "flac", label: "FLAC" },
          ]}
        />
        {(format === "mp3" || format === "m4a") && (
          <div className="mt-4">
            <Segmented
              layoutId="audio-kbps"
              value={kbps}
              onChange={(next: Kbps) => setKbps(next)}
              options={
                format === "m4a"
                  ? [
                      { value: "128", label: "128 kbps" },
                      { value: "192", label: "192 kbps" },
                      { value: "256", label: "256 kbps" },
                    ]
                  : [
                      { value: "128", label: "128 kbps" },
                      { value: "192", label: "192 kbps" },
                      { value: "320", label: "320 kbps" },
                    ]
              }
            />
          </div>
        )}
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t(NOTE_KEY[format])}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("audioConvert.run")}
        disabled={!picked}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
