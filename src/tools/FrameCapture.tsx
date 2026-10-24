import { useEffect, useState } from "react";
import { Slider } from "@/components/ui";
import { formatDuration } from "@/lib/files";
import {
  FileField,
  OutputCard,
  RunArea,
  ToolSection,
  useRunner,
  useToolFile,
} from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { captureFrame, readVideoMeta } from "@/lib/media";
import { useT } from "@/i18n";

export default function FrameCapture({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*");
  const [duration, setDuration] = useState(0);
  const [at, setAt] = useState(1);
  const { status, progress, error, result, run } = useRunner();

  useEffect(() => {
    setDuration(0);
    setAt(1);
    if (!picked) return;
    let alive = true;
    readVideoMeta(picked.file)
      .then((meta) => {
        if (!alive) return;
        setDuration(meta.duration);
        setAt(Math.min(1, Math.max(0, meta.duration / 2)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [picked]);

  const start = () => {
    if (!picked) return;
    void run("Video → Kare", async (onProgress) => {
      onProgress(0.1);
      const frame = await captureFrame(picked.url, at);
      onProgress(1);
      const stamp = Math.round(at).toString().padStart(2, "0");
      return {
        blob: frame.blob,
        name: `${picked.file.name.replace(/\.[^.]+$/, "")}-${stamp}s.png`,
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

      <ToolSection title={t("frame.time")}>
        {duration > 0 ? (
          <Slider
            label={t("frame.time")}
            display={formatDuration(at)}
            value={at}
            min={0}
            max={Math.max(0.1, duration)}
            step={0.1}
            onChange={setAt}
          />
        ) : (
          <p className="text-[13px] text-ink2">
            {picked ? t("trim.loading") : t("trim.noFile")}
          </p>
        )}
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("frame.note")}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("frame.capture")}
        disabled={!picked || duration <= 0}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
