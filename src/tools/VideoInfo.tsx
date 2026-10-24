import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { Check, XMark } from "@/components/Icons";
import { formatBytes, formatDuration } from "@/lib/files";
import { FileField, ToolSection, useToolFile } from "./ToolFrame";
import type { ToolProps } from "./ToolFrame";
import { probeCodecs, readVideoMeta } from "@/lib/media";
import type { CodecProbe, VideoMeta } from "@/lib/media";
import { useT } from "@/i18n";

export default function VideoInfo({ initialFileId }: ToolProps) {
  const t = useT();
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
      <ToolSection title={t("section.file")}>
        <FileField
          picked={picked}
          acceptLabel={t("info.accept")}
          onChoose={() => void choose()}
          onClear={clear}
        />
      </ToolSection>

      <Button full loading={busy} disabled={!picked} onClick={() => void start}>
        {t("info.run")}
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
          <ToolSection title={t("section.mediaInfo")}>
            <div className="space-y-2.5 text-[14px]">
              {[
                [t("info.duration"), formatDuration(meta.duration)],
                [
                  t("info.resolution"),
                  meta.width > 0 ? `${meta.width} × ${meta.height}` : t("info.unread"),
                ],
                [t("info.ratio"), ratio ?? "—"],
                [t("info.size"), formatBytes(picked.file.size)],
                [t("info.contentType"), meta.type],
                [
                  t("info.bitrate"),
                  meta.duration > 0
                    ? `${Math.round((picked.file.size * 8) / meta.duration / 1000)} kbps`
                    : "—",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-ink2">{label}</span>
                  <span className="truncate font-medium">{value}</span>
                </div>
              ))}
            </div>
          </ToolSection>

          <ToolSection title={t("section.support")}>
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
                    {probe.supported ? t("codec.supported") : t("codec.notSupported")}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.45] text-ink2">
              {t("info.supportNote")}
            </p>
          </ToolSection>
        </motion.div>
      )}
    </div>
  );
}
