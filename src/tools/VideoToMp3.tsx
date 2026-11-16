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
import { decodeMediaFile, encodeMp3 } from "@/lib/media";
import { useT } from "@/i18n";

export default function VideoToMp3({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*,audio/*");
  const [kbps, setKbps] = useState<"128" | "192" | "320">("192");
  const { status, progress, error, result, run, cancel } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Video → MP3", async (onProgress, signal) => {
      // Video dosyalarında WebAudio çözemezse ses FFmpeg ile ayrılır.
      const buffer = await decodeMediaFile(
        picked.file,
        (ratio) => onProgress(ratio * 0.35),
        signal,
      );
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(0.4);
      const blob = await encodeMp3(
        buffer,
        Number(kbps),
        (r) => onProgress(0.4 + r * 0.6),
        signal,
      );
      return { blob, name: replaceExt(picked.file.name, "mp3") };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel={t("mp3.accept")}
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title={t("section.bitrate")}>
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
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("mp3.note")}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("mp3.run")}
        disabled={!picked}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
