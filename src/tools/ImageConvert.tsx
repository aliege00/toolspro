import { useState } from "react";
import { Segmented, Slider } from "@/components/ui";
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
import { processImage } from "@/lib/media";
import { useT } from "@/i18n";

type Target = "jpeg" | "png" | "webp";

const extensions: Record<Target, string> = { jpeg: "jpg", png: "png", webp: "webp" };

export default function ImageConvert({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "image/*");
  const [target, setTarget] = useState<Target>("jpeg");
  const [quality, setQuality] = useState(90);
  const { status, progress, error, result, run } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Görsel Dönüştür", async (onProgress) => {
      onProgress(0.1);
      const blob = await processImage(picked.file, {
        quality: target === "png" ? 1 : quality / 100,
        type: `image/${target}`,
      });
      onProgress(1);
      return { blob, name: replaceExt(picked.file.name, extensions[target]) };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel={t("convert.accept")}
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title={t("convert.target")}>
        <Segmented
          layoutId="convert-target"
          value={target}
          onChange={setTarget}
          options={[
            { value: "jpeg" as const, label: "JPEG" },
            { value: "png" as const, label: "PNG" },
            { value: "webp" as const, label: "WebP" },
          ]}
        />
        {target !== "png" ? (
          <div className="mt-4">
            <Slider
              label={t("compress.quality")}
              display={`%${quality}`}
              value={quality}
              min={30}
              max={100}
              step={1}
              onChange={setQuality}
            />
          </div>
        ) : (
          <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("convert.pngNote")}</p>
        )}
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("convert.run")}
        disabled={!picked}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
