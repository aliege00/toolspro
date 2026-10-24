import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { zip } from "fflate";
import { Segmented, Slider } from "@/components/ui";
import { FileIcon, PlusIcon, XMark } from "@/components/Icons";
import { baseName, formatBytes, pickFiles } from "@/lib/files";
import {
  OutputCard,
  RunArea,
  SizeWarning,
  ToolSection,
  useRunner,
} from "./ToolFrame";
import { decodeToAudioBuffer, encodeMp3, processImage } from "@/lib/media";
import { useT } from "@/i18n";

type Mode = "image" | "audio";
type Format = "image/jpeg" | "image/png" | "image/webp";
type Width = "0" | "1280" | "1920" | "2560";
type Kbps = "128" | "192" | "320";

const FORMAT_EXT: Record<Format, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  let n = 2;
  while (used.has(`${base}-${n}${ext}`)) n += 1;
  const unique = `${base}-${n}${ext}`;
  used.add(unique);
  return unique;
}

export default function BatchConvert() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("image");
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [quality, setQuality] = useState(82);
  const [maxWidth, setMaxWidth] = useState<Width>("0");
  const [kbps, setKbps] = useState<Kbps>("192");
  const { status, progress, error, result, run, cancel, reset } = useRunner();

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  const changeMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setFiles([]);
    reset();
  };

  const addFiles = async () => {
    const picked = await pickFiles({
      multiple: true,
      accept: mode === "image" ? "image/*" : "video/*,audio/*",
    });
    if (picked.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...picked.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const start = () => {
    if (files.length === 0) return;
    void run("Toplu Dönüşüm", async (onProgress, signal) => {
      const entries: Record<string, Uint8Array> = {};
      const used = new Set<string>();

      for (let i = 0; i < files.length; i += 1) {
        if (signal.aborted) throw new DOMException("İptal", "AbortError");

        try {
          if (mode === "image") {
            const blob = await processImage(files[i], {
              type: format,
              quality: quality / 100,
              maxWidth: maxWidth === "0" ? undefined : Number(maxWidth),
            });
            const name = uniqueName(
              `${baseName(files[i].name)}.${FORMAT_EXT[format]}`,
              used,
            );
            entries[name] = new Uint8Array(await blob.arrayBuffer());
          } else {
            const buffer = await decodeToAudioBuffer(files[i]);
            const blob = await encodeMp3(
              buffer,
              Number(kbps),
              (ratio) => onProgress((i + 0.25 + ratio * 0.7) / files.length),
              signal,
            );
            const name = uniqueName(`${baseName(files[i].name)}.mp3`, used);
            entries[name] = new Uint8Array(await blob.arrayBuffer());
          }
        } catch (error) {
          if (signal.aborted) throw error;
          const reason = error instanceof Error ? error.message : "";
          throw new Error(`${files[i].name}: ${reason}`);
        }

        onProgress(((i + 1) / files.length) * 0.92);
      }

      if (signal.aborted) throw new DOMException("İptal", "AbortError");
      const zipped = await new Promise<Uint8Array>((resolve, reject) => {
        zip(entries, { level: 6 }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      onProgress(1);
      return {
        blob: new Blob([zipped as unknown as BlobPart], { type: "application/zip" }),
        name: "toplu-donusum.zip",
      };
    });
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("batch.mode")}>
        <Segmented
          layoutId="batch-mode"
          value={mode}
          onChange={changeMode}
          options={[
            { value: "image", label: t("batch.images") },
            { value: "audio", label: t("batch.audio") },
          ]}
        />
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("batch.note")}</p>
      </ToolSection>

      <ToolSection title={t("pdf.files")}>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {files.map((file, i) => (
              <motion.div
                key={`${file.name}:${file.size}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="flex items-center gap-2.5 rounded-[12px] bg-fill px-3 py-2.5"
              >
                <FileIcon size={17} className="shrink-0 text-ink3" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{file.name}</p>
                  <p className="text-[11.5px] text-ink2">
                    {formatBytes(file.size)} · {i + 1}/{files.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink3 active:bg-card"
                  aria-label={t("zip.remove")}
                >
                  <XMark size={15} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => void addFiles()}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-line py-3.5 text-[14px] font-medium text-tint active:bg-fill"
          >
            <PlusIcon size={17} />
            {files.length === 0 ? t("file.pick") : t("zip.addShort")}
          </button>
        </div>
      </ToolSection>

      <SizeWarning bytes={totalBytes} />

      <ToolSection title={t("section.format")}>
        {mode === "image" ? (
          <div className="space-y-4">
            <Segmented
              layoutId="batch-format"
              value={format}
              onChange={setFormat}
              options={[
                { value: "image/jpeg", label: "JPEG" },
                { value: "image/png", label: "PNG" },
                { value: "image/webp", label: "WebP" },
              ]}
            />
            <Slider
              label={t("compress.quality")}
              display={`${quality}%`}
              value={quality}
              min={40}
              max={100}
              step={1}
              onChange={setQuality}
            />
            {format === "image/png" && (
              <p className="text-[12.5px] leading-[1.45] text-ink2">{t("convert.pngNote")}</p>
            )}
            <Segmented
              layoutId="batch-width"
              value={maxWidth}
              onChange={setMaxWidth}
              options={[
                { value: "0", label: t("compress.original") },
                { value: "1280", label: "1280" },
                { value: "1920", label: "1920" },
                { value: "2560", label: "2560" },
              ]}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Segmented
              layoutId="batch-kbps"
              value={kbps}
              onChange={setKbps}
              options={[
                { value: "128", label: "128 kbps" },
                { value: "192", label: "192 kbps" },
                { value: "320", label: "320 kbps" },
              ]}
            />
            <p className="text-[12.5px] leading-[1.45] text-ink2">{t("batch.audioNote")}</p>
          </div>
        )}
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("batch.run")}
        disabled={files.length === 0}
        onCancel={cancel}
      />

      {result && <OutputCard output={result} />}

      {files.length > 0 && (
        <p className="text-center text-[12.5px] text-ink2">
          {t("files.items", { n: files.length })} · {formatBytes(totalBytes)}
        </p>
      )}
    </div>
  );
}
