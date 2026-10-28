import { useEffect, useRef, useState } from "react";
import { Segmented, Toggle } from "@/components/ui";
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

type Rotation = "0" | "90" | "180" | "270";
type Aspect = "free" | "1:1" | "4:5" | "16:9" | "9:16";
type Format = "image/jpeg" | "image/png";

const ASPECT_VALUE: Record<Exclude<Aspect, "free">, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

function renderEdited(
  image: HTMLImageElement,
  rotate: Rotation,
  flipH: boolean,
  flipV: boolean,
  aspect: Aspect,
  width: number,
  signal?: AbortSignal,
): HTMLCanvasElement {
  if (signal?.aborted) throw new DOMException("İptal", "AbortError");
  const angle = Number(rotate);
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  const swapped = angle === 90 || angle === 270;

  const rotated = document.createElement("canvas");
  rotated.width = swapped ? sourceH : sourceW;
  rotated.height = swapped ? sourceW : sourceH;
  const rotatedCtx = rotated.getContext("2d");
  if (!rotatedCtx) throw new Error("canvas");

  rotatedCtx.translate(rotated.width / 2, rotated.height / 2);
  rotatedCtx.rotate((angle * Math.PI) / 180);
  rotatedCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  rotatedCtx.drawImage(image, -sourceW / 2, -sourceH / 2);

  let cropX = 0;
  let cropY = 0;
  let cropW = rotated.width;
  let cropH = rotated.height;

  if (aspect !== "free") {
    const ratio = ASPECT_VALUE[aspect];
    if (rotated.width / rotated.height > ratio) {
      cropW = rotated.height * ratio;
    } else {
      cropH = rotated.width / ratio;
    }
    cropX = (rotated.width - cropW) / 2;
    cropY = (rotated.height - cropH) / 2;
  }

  const outW = Math.max(16, Math.round(width || cropW));
  const outH = Math.max(16, Math.round((outW * cropH) / cropW));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(rotated, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
  return out;
}

export default function ImageEdit({ initialFileId }: ToolProps) {
  const t = useT();
  const { picked, choose, clear } = useToolFile(initialFileId, "image/*");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rotate, setRotate] = useState<Rotation>("0");
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspect, setAspect] = useState<Aspect>("free");
  const [width, setWidth] = useState(0);
  const [format, setFormat] = useState<Format>("image/jpeg");
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const { status, progress, error, result, run, cancel } = useRunner();

  useEffect(() => {
    setImage(null);
    setWidth(0);
    setRotate("0");
    setFlipH(false);
    setFlipV(false);
    setAspect("free");
    if (!picked) return;
    let alive = true;
    void loadImage(picked.url)
      .then((loaded) => {
        if (!alive) return;
        setImage(loaded);
        setWidth(Math.min(loaded.naturalWidth || loaded.width, 4096));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [picked]);

  useEffect(() => {
    if (!image || !previewRef.current) return;
    try {
      const out = renderEdited(image, rotate, flipH, flipV, aspect, width || image.naturalWidth);
      const canvas = previewRef.current;
      canvas.width = out.width;
      canvas.height = out.height;
      canvas.getContext("2d")?.drawImage(out, 0, 0);
    } catch {
      // Önizleme oluşturulamazsa sonraki ayarda yeniden denenir.
    }
  }, [image, rotate, flipH, flipV, aspect, width]);

  const start = () => {
    if (!picked || !image) return;
    void run("Görsel Düzenle", async (onProgress, signal) => {
      onProgress(0.15);
      const canvas = renderEdited(image, rotate, flipH, flipV, aspect, width, signal);
      onProgress(0.55);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, format, format === "image/jpeg" ? 0.92 : undefined),
      );
      if (!blob) throw new Error(t("imageEdit.error"));
      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      onProgress(1);
      const ext = format === "image/png" ? "png" : "jpg";
      const base = picked.file.name.replace(/\.[^.]+$/, "");
      return { blob, name: `${base}-duzenlenmis.${ext}` };
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
          {image && (
            <div className="flex h-48 items-center justify-center overflow-hidden rounded-[12px] bg-fill">
              <canvas
                ref={previewRef}
                className="max-h-full max-w-full object-contain"
                aria-label={t("imageEdit.preview")}
              />
            </div>
          )}
        </div>
      </ToolSection>

      <ToolSection title={t("imageEdit.transform")}>
        <Segmented
          layoutId="image-rotate"
          value={rotate}
          onChange={setRotate}
          options={[
            { value: "0", label: "0°" },
            { value: "90", label: "90°" },
            { value: "180", label: "180°" },
            { value: "270", label: "270°" },
          ]}
        />
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[15px]">{t("videoRotate.flipH")}</span>
            <Toggle checked={flipH} onChange={setFlipH} label={t("videoRotate.flipH")} />
          </div>
          <div className="flex items-center justify-between border-t border-line py-1.5">
            <span className="text-[15px]">{t("videoRotate.flipV")}</span>
            <Toggle checked={flipV} onChange={setFlipV} label={t("videoRotate.flipV")} />
          </div>
        </div>
      </ToolSection>

      <ToolSection title={t("imageEdit.crop")}>
        <Segmented
          layoutId="image-aspect"
          value={aspect}
          onChange={setAspect}
          options={[
            { value: "free", label: t("imageEdit.free") },
            { value: "1:1", label: "1:1" },
            { value: "4:5", label: "4:5" },
            { value: "16:9", label: "16:9" },
            { value: "9:16", label: "9:16" },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("imageEdit.cropNote")}</p>
      </ToolSection>

      <ToolSection title={t("imageEdit.size")}>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={16}
            max={8192}
            value={width || ""}
            onChange={(event) => {
              const next = Number(event.target.value);
              setWidth(Number.isFinite(next) ? Math.min(8192, Math.max(16, next)) : 0);
            }}
            className="h-11 w-full rounded-[12px] bg-fill px-4 text-[15px] outline-none"
          />
          <span className="shrink-0 text-[13px] text-ink2">px</span>
        </div>
        <div className="mt-4">
          <Segmented
            layoutId="image-edit-format"
            value={format}
            onChange={setFormat}
            options={[
              { value: "image/jpeg", label: "JPEG" },
              { value: "image/png", label: "PNG" },
            ]}
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("imageEdit.note")}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("imageEdit.run")}
        disabled={!picked || !image}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}
    </div>
  );
}
