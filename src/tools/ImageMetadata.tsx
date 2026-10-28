import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui";
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
import { useT } from "@/i18n";

type Format = "image/jpeg" | "image/png" | "image/webp";

const FORMAT_EXT: Record<Format, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

export default function ImageMetadata({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "image/*");
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const { status, progress, error, result, run, cancel } = useRunner();

  useEffect(() => {
    setImage(null);
    if (!picked) return;
    let alive = true;
    void loadImage(picked.url).then((loaded) => {
      if (alive) setImage(loaded);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [picked]);

  const start = () => {
    if (!picked || !image) return;
    void run("Meta Veri Temizle", async (onProgress, signal) => {
      onProgress(0.1);
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) throw new Error(t("imageMetadata.error"));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(t("imageMetadata.error"));
      ctx.drawImage(image, 0, 0);
      onProgress(0.45);

      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(
          resolve,
          format,
          format === "image/png" ? undefined : 0.92,
        ),
      );
      if (!blob) throw new Error(t("imageMetadata.error"));
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(1);

      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return {
        blob,
        name: `${base}-meta-temiz.${FORMAT_EXT[format]}`,
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <div className="space-y-3">
          <FileField
            picked={picked}
            acceptLabel={t("compress.accept")}
            onChoose={() => void choose()}
            onClear={clear}
          />
          <SizeWarning bytes={picked?.file.size ?? 0} threshold={25 * 1024 * 1024} />
        </div>
      </ToolSection>

      <p className="rounded-[12px] bg-fill px-3.5 py-3 text-[12.5px] leading-[1.5] text-ink2">
        {t("imageMetadata.note")}
      </p>

      <ToolSection title={t("section.format")}>
        <Segmented
          layoutId="meta-format"
          value={format}
          onChange={setFormat}
          options={[
            { value: "image/jpeg", label: "JPEG" },
            { value: "image/png", label: "PNG" },
            { value: "image/webp", label: "WebP" },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
          {t("imageMetadata.formatNote")}
        </p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("imageMetadata.run")}
        disabled={!picked || !image}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
