import { useState } from "react";
import { Segmented, Slider } from "@/components/ui";
import { formatBytes } from "@/lib/files";
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

export default function ImageCompress({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "image/*");
  const [maxWidth, setMaxWidth] = useState<"0" | "1920" | "1280" | "720">("1920");
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState<"image/jpeg" | "image/webp">("image/jpeg");
  const { status, progress, error, result, run } = useRunner();

  const start = () => {
    if (!picked) return;
    void run("Görsel Sıkıştır", async (onProgress) => {
      onProgress(0.1);
      const blob = await processImage(picked.file, {
        maxWidth: Number(maxWidth) || undefined,
        quality: quality / 100,
        type: format,
      });
      onProgress(1);
      return {
        blob,
        name: replaceExt(picked.file.name, format === "image/webp" ? "webp" : "jpg"),
      };
    });
  };

  const diff =
    result && picked
      ? Math.round((1 - result.size / picked.file.size) * 100)
      : null;

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel={t("compress.accept")}
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <ToolSection title={t("section.settings")}>
        <Segmented
          layoutId="compress-width"
          value={maxWidth}
          onChange={setMaxWidth}
          options={[
            { value: "0", label: t("compress.original") },
            { value: "1920", label: "1920 px" },
            { value: "1280", label: "1280 px" },
            { value: "720", label: "720 px" },
          ]}
        />
        <div className="mt-4">
          <Slider
            label={t("compress.quality")}
            display={`%${quality}`}
            value={quality}
            min={30}
            max={95}
            step={1}
            onChange={setQuality}
          />
        </div>
        <div className="mt-4">
          <Segmented
            layoutId="compress-format"
            value={format}
            onChange={setFormat}
            options={[
              { value: "image/jpeg" as const, label: "JPEG" },
              { value: "image/webp" as const, label: "WebP" },
            ]}
          />
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("compress.run")}
        disabled={!picked}
      />

      {result && picked && (
        <p className="text-[13px] text-ink2">
          {formatBytes(picked.file.size)} → {formatBytes(result.size)}
          {diff !== null && diff > 0
            ? ` · ${t("compress.shrunk", { p: diff })}`
            : ` · ${t("compress.notShrunk")}`}
        </p>
      )}

      {result && <OutputCard output={result} />}
    </div>
  );
}
