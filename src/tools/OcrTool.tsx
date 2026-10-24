import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button, Segmented } from "@/components/ui";
import { OutputCard, RunArea, ToolSection, useRunner } from "./ToolFrame";
import { pickFiles } from "@/lib/files";
import { useT } from "@/i18n";

const OFFLINE_LANGS = [
  { code: "tur", label: "Türkçe" },
  { code: "eng", label: "English" },
];

const ONLINE_LANGS = [
  { code: "deu", label: "Deutsch" },
  { code: "fra", label: "Français" },
  { code: "spa", label: "Español" },
  { code: "ita", label: "Italiano" },
  { code: "por", label: "Português" },
  { code: "rus", label: "Русский" },
  { code: "ara", label: "العربية" },
  { code: "jpn", label: "日本語" },
  { code: "kor", label: "한국어" },
  { code: "chi_sim", label: "中文" },
];

const TESSDATA_FAST =
  "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_fast";

export default function OcrTool() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState("tur");
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { status, progress, error, result: output, run } = useRunner();

  const offline = lang === "tur" || lang === "eng";

  useEffect(() => {
    setText(null);
    setCopied(false);
  }, [file, lang]);

  const chooseFile = async () => {
    const files = await pickFiles({ accept: "image/*" });
    if (files[0]) setFile(files[0]);
  };

  const start = () => {
    if (!file) return;
    void run("OCR", async (onProgress) => {
      onProgress(0.05);
      const { createWorker } = await import("tesseract.js");
      const base = import.meta.env.BASE_URL;

      const worker = await createWorker(lang, 1, {
        workerPath: `${base}ocr/worker.min.js`,
        corePath: `${base}ocr/core/`,
        langPath: offline ? `${base}ocr/lang` : TESSDATA_FAST,
        // Android aapt .gz paketlerini açtığı için çevrimdışı paketler düz metindir;
        // CDN'deki tessdata_fast dosyaları ise .gz olarak kalır.
        gzip: !offline,
        workerBlobURL: false,
        logger: (message: { status: string; progress: number }) => {
          if (message.status === "recognizing text") {
            onProgress(0.35 + message.progress * 0.6);
          } else {
            onProgress(Math.min(0.3, message.progress * 0.3));
          }
        },
      });

      try {
        const result = await worker.recognize(file);
        const extracted = (result.data.text ?? "").trim();
        if (!extracted) throw new Error(t("ocr.empty"));
        onProgress(1);
        return {
          blob: new Blob([extracted], { type: "text/plain;charset=utf-8" }),
          name: "yazi.txt",
        };
      } finally {
        await worker.terminate();
      }
    }).then(() => undefined);
  };

  useEffect(() => {
    if (!output) return;
    let alive = true;
    void output.blob.text().then((value) => {
      if (alive) setText(value);
    });
    return () => {
      alive = false;
    };
  }, [output]);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const runError = error === t("ocr.empty") ? error : error ? t("ocr.error") : null;

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.file")}>
        <button
          type="button"
          onClick={() => void chooseFile()}
          className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-4 text-left active:bg-fill"
        >
          {file ? (
            <img
              src={URL.createObjectURL(file)}
              alt=""
              className="h-14 w-14 shrink-0 rounded-[10px] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-fill text-tint text-[13px] font-semibold">
              PNG
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">
              {file?.name ?? t("file.pick")}
            </p>
            <p className="text-[12.5px] text-ink2">{t("compress.accept")}</p>
          </div>
        </button>
      </ToolSection>

      <ToolSection title={t("ocr.lang")}>
        <div className="space-y-3">
          <Segmented
            layoutId="ocr-lang"
            value={lang === "eng" ? "eng" : "tur"}
            onChange={(next) => setLang(next)}
            options={[
              { value: "tur", label: `Türkçe · ${t("ocr.offline")}` },
              { value: "eng", label: `English · ${t("ocr.offline")}` },
            ]}
          />
          <div>
            <p className="mb-1.5 text-[13px] text-ink2">{t("ocr.other")}</p>
            <select
              value={OFFLINE_LANGS.some((l) => l.code === lang) ? "" : lang}
              onChange={(e) => {
                if (e.target.value) setLang(e.target.value);
              }}
              className="h-11 w-full rounded-[12px] bg-fill px-3 text-[15px] outline-none"
            >
              <option value="">—</option>
              {ONLINE_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[12.5px] leading-[1.45] text-ink2">{t("ocr.onlineNote")}</p>
        </div>
      </ToolSection>

      <RunArea
        status={status}
        progress={progress}
        error={runError}
        onRun={start}
        runLabel={t("ocr.run")}
        disabled={!file}
      />

      {text && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <p className="mb-2 text-[12px] font-semibold text-ink2 uppercase">
            {t("ocr.text")}
          </p>
          <p className="max-h-[260px] overflow-y-auto text-[14px] leading-[1.5] whitespace-pre-wrap no-scrollbar">
            {text}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void copy()}>
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
        </motion.div>
      )}

      {output && <OutputCard output={output} />}
    </div>
  );
}
