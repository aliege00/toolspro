import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { Check, XMark } from "@/components/Icons";
import { formatBytes, formatDuration } from "@/lib/files";
import { FileField, ToolSection, useToolFile } from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { probeCodecs, readVideoMeta } from "@/lib/media";
import type { CodecProbe, VideoMeta } from "@/lib/media";

export default function VideoInfo({ initialFileId }: ToolProps) {
  const { picked, choose, clear } = useToolFile(initialFileId, "video/*,audio/*");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [probes, setProbes] = useState<CodecProbe[]>([]);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    setMeta(null);
    try {
      const info = await readVideoMeta(picked.file);
      setMeta(info);
      setProbes(probeCodecs());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilgi okunamadı.");
    } finally {
      setBusy(false);
    }
  };

  const ratio =
    meta && meta.height > 0 ? (meta.width / meta.height).toFixed(2) : null;

  return (
    <div className="space-y-5">
      <ToolSection title="Dosya">
        <FileField
          picked={picked}
          acceptLabel="Video veya ses dosyası"
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <Button full loading={busy} disabled={!picked} onClick={() => void start}>
        Bilgileri Oku
      </Button>

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

      {meta && picked && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <ToolSection title="Video bilgileri">
            <div className="space-y-2.5 text-[14px]">
              {[
                ["Süre", formatDuration(meta.duration)],
                ["Çözünürlük", meta.width > 0 ? `${meta.width} × ${meta.height}` : "okunamadı"],
                ["En-boy", ratio ?? "—"],
                ["Dosya boyutu", formatBytes(picked.file.size)],
                ["İçerik türü", meta.type],
                ["Ortalama bit hızı",
                  meta.duration > 0
                    ? `${Math.round((picked.file.size * 8) / meta.duration / 1000)} kbps`
                    : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-ink2">{label}</span>
                  <span className="truncate font-medium">{value}</span>
                </div>
              ))}
            </div>
          </ToolSection>

          <ToolSection title="Oynatma desteği">
            <div className="space-y-2 text-[13.5px]">
              {probes.map((probe) => (
                <div key={probe.mime} className="flex items-center justify-between gap-3">
                  <span className="text-ink2">{probe.label}</span>
                  <span
                    className={
                      probe.supported
                        ? "flex items-center gap-1 font-medium text-success"
                        : "flex items-center gap-1 font-medium text-ink3"
                    }
                  >
                    {probe.supported ? <Check size={16} /> : <XMark size={16} />}
                    {probe.supported ? "Destekleniyor" : "Desteklenmiyor"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
              Sonuçlar bu cihazın oynatıcı motoruna (WebView) göredir; başka bir
              oynatıcıda farklılık gösterebilir.
            </p>
          </ToolSection>
        </motion.div>
      )}
    </div>
  );
}
