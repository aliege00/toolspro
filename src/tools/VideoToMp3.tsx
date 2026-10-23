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
import { decodeToAudioBuffer, encodeMp3 } from "@/lib/media";

export default function VideoToMp3({ initialFileId }: ToolProps) {
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*,audio/*");
  const [kbps, setKbps] = useState<"128" | "192" | "320">("192");
  const { status, progress, error, result, run } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Video → MP3", async (onProgress) => {
      const buffer = await decodeToAudioBuffer(picked.file);
      onProgress(0.12);
      const blob = await encodeMp3(buffer, Number(kbps), (r) =>
        onProgress(0.12 + r * 0.88),
      );
      return { blob, name: replaceExt(picked.file.name, "mp3") };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title="Dosya">
        <FileField
          picked={picked}
          acceptLabel="Video veya ses dosyası (MP4, MKV, MOV...)"
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title="Bit hızı">
        <Segmented
          layoutId="mp3-kbps"
          value={kbps}
          onChange={setKbps}
          options={[
            { value: "128", label: "128 kbps" },
            { value: "192", label: "192 kbps" },
            { value: "320", label: "320 kbps" },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          Ses, cihazın yerleşik çözücüsüyle PCM'e çevrilip MP3'e kodlanır. Uzun
          videolarda bu işlem bellek tüketir ve biraz sürebilir.
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel="MP3 Çıktısı Al"
        disabled={!picked}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
