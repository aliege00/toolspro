import { useEffect, useState } from "react";
import { Segmented, Slider } from "@/components/ui";
import { formatDuration } from "@/lib/files";
import {
  FileField,
  OutputCard,
  RunArea,
  ToolSection,
  replaceExt,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { decodeToAudioBuffer, encodeMp3, encodeWav, sliceBuffer } from "@/lib/media";

export default function AudioTrim({ initialFileId }: ToolProps) {
  const { picked, choose, clear } = useToolFile(initialFileId, "audio/*,video/*");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const { status, progress, error, result, run } = useRunner();

  useEffect(() => {
    setDuration(0);
    setStart(0);
    setEnd(0);
    if (!picked) return;

    const media = document.createElement("audio");
    media.preload = "metadata";
    media.src = picked.url;

    const timer = window.setTimeout(() => {
      media.removeAttribute("src");
      media.load();
    }, 12000);

    media.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const total = media.duration || 0;
      setDuration(total);
      setEnd(total);
      media.removeAttribute("src");
      media.load();
    };
    media.onerror = () => {
      window.clearTimeout(timer);
      media.removeAttribute("src");
      media.load();
    };

    return () => window.clearTimeout(timer);
  }, [picked]);

  const trimDuration = Math.max(0, end - start);

  const startRun = () => {
    if (!picked) return;
    void run("Ses Kırp", async (onProgress) => {
      const buffer = await decodeToAudioBuffer(picked.file);
      onProgress(0.2);
      const sliced = sliceBuffer(buffer, start, end);
      onProgress(0.3);

      if (format === "wav") {
        const blob = encodeWav(sliced);
        onProgress(1);
        return { blob, name: replaceExt(picked.file.name, "wav") };
      }

      const blob = await encodeMp3(sliced, 192, (r) => onProgress(0.3 + r * 0.7));
      return { blob, name: replaceExt(picked.file.name, "mp3") };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title="Dosya">
        <FileField
          picked={picked}
          acceptLabel="Ses veya video dosyası"
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title="Aralık">
        {duration > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-ink2">Seçili aralık</span>
              <span className="font-semibold">
                {formatDuration(start)} → {formatDuration(end)} ·{" "}
                {formatDuration(trimDuration)}
              </span>
            </div>
            <Slider
              label="Başlangıç"
              display={formatDuration(start)}
              value={start}
              min={0}
              max={Math.max(0.1, end - 0.5)}
              step={0.1}
              onChange={setStart}
            />
            <Slider
              label="Bitiş"
              display={formatDuration(end)}
              value={end}
              min={Math.min(duration, start + 0.5)}
              max={duration}
              step={0.1}
              onChange={setEnd}
            />
          </div>
        ) : (
          <p className="text-[13px] leading-[1.45] text-ink2">
            {picked
              ? "Süre okunuyor, kısa bir bekleme olabilir."
              : "Ayarları görmek için bir dosya seç."}
          </p>
        )}
      </ToolSection>

      <ToolSection title="Çıktı biçimi">
        <Segmented
          layoutId="trim-format"
          value={format}
          onChange={setFormat}
          options={[
            { value: "mp3", label: "MP3" },
            { value: "wav", label: "WAV (kayısız)" },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          WAV sıkıştırılmadığı için dosya boyutu büyük olur; MP3 192 kbps ile
          kodlanır.
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={startRun}
        runLabel="Kırp ve Çıktı Al"
        disabled={!picked || duration <= 0 || trimDuration < 0.1}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
