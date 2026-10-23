import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, ProgressBar } from "@/components/ui";
import { formatDate, formatBytes } from "@/lib/files";
import { FileField, ToolSection, useToolFile } from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { sha256Hex } from "@/lib/media";

export default function HashTool({ initialFileId }: ToolProps) {
  const { picked, choose, clear } = useToolFile(initialFileId, undefined);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const start = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    setHash(null);
    setProgress(0);
    setCopied(false);
    try {
      const result = await sha256Hex(picked.file, setProgress);
      setHash(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parmak izi hesaplanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolSection title="Dosya">
        <FileField
          picked={picked}
          acceptLabel="Herhangi bir dosya"
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      {picked && (
        <ToolSection title="Bilgiler">
          <div className="space-y-2.5 text-[14px]">
            {[
              ["Ad", picked.file.name],
              ["Boyut", formatBytes(picked.file.size)],
              ["İçerik türü", picked.file.type || "bilinmiyor"],
              ["Değiştirilme", formatDate(picked.file.lastModified)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="shrink-0 text-ink2">{label}</span>
                <span className="truncate text-right font-medium">{value}</span>
              </div>
            ))}
          </div>
        </ToolSection>
      )}

      <div className="space-y-3">
        <Button full loading={busy} disabled={!picked} onClick={() => void start()}>
          SHA-256 Hesapla
        </Button>
        {busy && (
          <div className="space-y-1.5">
            <ProgressBar ratio={progress} />
            <p className="text-center text-[12.5px] text-ink2">
              Okunuyor · %{Math.round(progress * 100)}
            </p>
          </div>
        )}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-[12px] bg-danger/10 px-3.5 py-3 text-[13px] leading-[1.45] text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {hash && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink2 uppercase">
              SHA-256
            </p>
            <p className="font-mono text-[11.5px] leading-[1.5] break-all">{hash}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void copy()}>
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setHash(null)}>
                Temizle
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
