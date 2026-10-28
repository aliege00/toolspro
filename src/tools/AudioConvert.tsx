import { useState } from "react";
import { Segmented } from "@/components/ui";
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
import { decodeToAudioBuffer, encodeMp3, encodeWav } from "@/lib/media";
import { useT } from "@/i18n";

type Format = "mp3" | "wav";

export default function AudioConvert({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*,audio/*");
  const [format, setFormat] = useState<Format>("mp3");
  const [kbps, setKbps] = useState<"128" | "192" | "320">("192");
  const { status, progress, error, result, run } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Ses Dönüştür", async (onProgress) => {
      const buffer = await decodeToAudioBuffer(picked.file);
      onProgress(0.15);

      if (format === "wav") {
        const blob = encodeWav(buffer);
        onProgress(1);
        return { blob, name: replaceExt(picked.file.name, "wav") };
      }

      const blob = await encodeMp3(buffer, Number(kbps), (ratio) =>
        onProgress(0.15 + ratio * 0.85),
      );
      return { blob, name: replaceExt(picked.file.name, "mp3") };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel={t("audioConvert.accept")}
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title={t("audioConvert.format")}>
        <Segmented
          layoutId="audio-format"
          value={format}
          onChange={setFormat}
          options={[
            { value: "mp3", label: "MP3" },
            { value: "wav", label: "WAV" },
          ]}
        />
        {format === "mp3" && (
          <div className="mt-4">
            <Segmented
              layoutId="audio-kbps"
              value={kbps}
              onChange={setKbps}
              options={[
                { value: "128", label: "128 kbps" },
                { value: "192", label: "192 kbps" },
                { value: "320", label: "320 kbps" },
              ]}
            />
          </div>
        )}
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          {t(format === "wav" ? "audioConvert.wavNote" : "audioConvert.mp3Note")}
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("audioConvert.run")}
        disabled={!picked}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
