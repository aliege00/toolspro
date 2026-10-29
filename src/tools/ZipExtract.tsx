import { useCallback, useRef, useState } from "react";
import { Unzip, UnzipInflate } from "fflate";
import { Button } from "@/components/ui";
import { ArchiveIcon, FileIcon } from "@/components/Icons";
import { ARCHIVE_WARN_BYTES, formatBytes, pickFiles } from "@/lib/files";
import { logError } from "@/lib/errorLog";
import { useLibrary } from "@/lib/library";
import { useNav } from "@/lib/nav";
import { RunArea, SizeWarning, ToolSection } from "./ToolFrame";
import { useT } from "@/i18n";

type Status = "idle" | "working" | "cancelled" | "done" | "error";
type Summary = { count: number; bytes: number; names: string[] };

const MAX_ENTRIES = 500;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

function concatChunks(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Zip-slip ve mutlak yolları reddet; arşiv içi ad hiçbir zaman yol olarak kullanılmaz. */
function unsafePath(raw: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith("/") || raw.startsWith("\\")) {
    return true;
  }
  return raw.split(/[\\/]+/).some((part) => part === "..");
}

/** Aynı ad çakışırsa üzerine yazmak yerine -1, -2 ... ekler. */
function uniqueName(raw: string, used: Set<string>): string {
  const base = raw.split(/[\\/]+/).pop()?.trim() || "dosya";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot <= 0 ? base : base.slice(0, dot);
  const ext = dot <= 0 ? "" : base.slice(dot);
  let n = 1;
  while (used.has(`${stem}-${n}${ext}`)) n += 1;
  const name = `${stem}-${n}${ext}`;
  used.add(name);
  return name;
}

export default function ZipExtract() {
  const t = useT();
  const { addFiles } = useLibrary();
  const { push } = useNav();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const controller = useRef<AbortController | null>(null);

  const choose = async () => {
    const files = await pickFiles({ accept: ".zip,application/zip,application/x-zip-compressed" });
    if (files[0]) {
      setFile(files[0]);
      setSummary(null);
      setStatus("idle");
      setError(null);
    }
  };

  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const start = () => {
    if (!file) return;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    const signal = task.signal;
    setStatus("working");
    setProgress(0);
    setError(null);
    setSummary(null);

    void (async () => {
      try {
        if (file.size > MAX_TOTAL_BYTES) throw new Error(t("zipExtract.tooBig"));
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (signal.aborted) throw new DOMException("İptal", "AbortError");

        const used = new Set<string>();
        const unpacked: File[] = [];
        let totalBytes = 0;
        let fatal: string | null = null;

        const unzip = new Unzip((entry) => {
          if (fatal) return;
          if (entry.name.endsWith("/")) return;
          if (unsafePath(entry.name)) {
            fatal = t("zipExtract.unsafePath");
            return;
          }
          const chunks: Uint8Array[] = [];
          entry.ondata = (err, chunk, final) => {
            if (fatal) return;
            if (err) {
              fatal = t("zipExtract.invalid");
              return;
            }
            if (chunk.length > 0) chunks.push(chunk);
            if (!final) return;
            if (unpacked.length >= MAX_ENTRIES) {
              fatal = t("zipExtract.tooMany", { n: MAX_ENTRIES });
              return;
            }
            const data = concatChunks(chunks);
            totalBytes += data.length;
            if (totalBytes > MAX_TOTAL_BYTES) {
              fatal = t("zipExtract.tooBig");
              return;
            }
            unpacked.push(new File([data], uniqueName(entry.name, used)));
          };
          try {
            entry.start();
          } catch {
            fatal = t("zipExtract.unsupported");
          }
        });

        unzip.register(UnzipInflate);
        const chunkSize = 512 * 1024;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          if (signal.aborted) throw new DOMException("İptal", "AbortError");
          const end = Math.min(bytes.length, offset + chunkSize);
          unzip.push(bytes.subarray(offset, end), end >= bytes.length);
          if (fatal) throw new Error(fatal);
          setProgress(0.05 + (end / bytes.length) * 0.55);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        if (fatal) throw new Error(fatal);
        if (unpacked.length === 0) throw new Error(t("zipExtract.empty"));
        if (signal.aborted) throw new DOMException("İptal", "AbortError");

        addFiles(unpacked);
        setProgress(1);
        setSummary({
          count: unpacked.length,
          bytes: totalBytes,
          names: unpacked.slice(0, 8).map((item) => item.name),
        });
        setStatus("done");
      } catch (e) {
        if (signal.aborted) {
          setProgress(0);
          setStatus("cancelled");
          return;
        }
        logError("ZIP Aç", e);
        setError(e instanceof Error ? e.message : t("zipExtract.invalid"));
        setStatus("error");
      }
    })();
  };

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        {file ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-fill p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-card text-ink2">
              <ArchiveIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium">{file.name}</p>
              <p className="text-[12.5px] text-ink2">{formatBytes(file.size)}</p>
            </div>
            <Button size="sm" variant="gray" onClick={() => void choose()}>
              {t("common.change")}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void choose()}
            className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-left active:bg-fill"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
              <ArchiveIcon size={22} />
            </div>
            <div>
              <p className="text-[15px] font-semibold">{t("zipExtract.pick")}</p>
              <p className="text-[12.5px] text-ink2">{t("zipExtract.accept")}</p>
            </div>
          </button>
        )}
        <div className="mt-3">
          <SizeWarning
            bytes={file?.size ?? 0}
            threshold={ARCHIVE_WARN_BYTES}
            messageKey="run.largeZip"
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">{t("zipExtract.note")}</p>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={error}
        onRun={start}
        runLabel={t("zipExtract.run")}
        disabled={!file}
        onCancel={cancel}
      />

      {status === "done" && summary && (
        <div className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tile text-tile-ink">
              <FileIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold">
                {t("zipExtract.done", { n: summary.count })}
              </p>
              <p className="text-[12.5px] text-ink2">{formatBytes(summary.bytes)}</p>
            </div>
          </div>
          {summary.names.length > 0 && (
            <p className="mt-2 truncate text-[12px] text-ink3">{summary.names.join(" · ")}</p>
          )}
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => push({ name: "files" })}>
              {t("zipExtract.openFiles")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
