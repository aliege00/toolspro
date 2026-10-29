import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button, Sheet } from "@/components/ui";
import { useT } from "@/i18n";
import { useLibrary } from "@/lib/library";
import { copyText } from "@/lib/clipboard";
import { formatBytes } from "@/lib/files";
import {
  formatErrorLog,
  getErrorLog,
  subscribeErrorLog,
} from "@/lib/errorLog";
import { getFFmpeg } from "@/lib/ffmpeg";
import { readDeviceDiagnostics } from "@/lib/native";
import type { DeviceDiagnosticsInfo } from "@/lib/native";

const APP_VERSION = "1.0.0";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-[12.5px] text-ink2">{label}</span>
      <span className="max-w-[62%] text-right text-[12.5px] font-medium break-words">
        {value}
      </span>
    </div>
  );
}

export default function DiagnosticsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { entries, trashed, hidden } = useLibrary();
  const errors = useSyncExternalStore(subscribeErrorLog, getErrorLog, getErrorLog);
  const [device, setDevice] = useState<DeviceDiagnosticsInfo | null>(null);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [ffmpeg, setFfmpeg] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [ffmpegMs, setFfmpegMs] = useState<number | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void readDeviceDiagnostics().then((info) => {
      if (alive) setDevice(info);
    });
    void (async () => {
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (alive && estimate) {
          setQuota({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
        }
      } catch {
        if (alive) setQuota(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const testFFmpeg = useCallback(async () => {
    setFfmpeg("loading");
    setFfmpegMs(null);
    const started = performance.now();
    try {
      const instance = await getFFmpeg();
      await instance.exec(["-hide_banner", "-version"]);
      setFfmpegMs(Math.round(performance.now() - started));
      setFfmpeg("ok");
    } catch {
      setFfmpegMs(Math.round(performance.now() - started));
      setFfmpeg("fail");
    }
  }, []);

  const report = [
    `BeyTool ${APP_VERSION} · ${new Date().toISOString()}`,
    device
      ? `Cihaz: ${device.device ?? "?"} · Android ${device.android ?? "?"} (SDK ${device.sdk ?? "?"})`
      : "Cihaz: web",
    device?.freeBytes !== undefined
      ? `Depolama: ${formatBytes(device.freeBytes)} boş / ${formatBytes(device.totalBytes ?? 0)}`
      : quota
        ? `Kota: ${formatBytes(Math.max(0, quota.quota - quota.usage))} boş / ${formatBytes(quota.quota)}`
        : "Depolama: bilinmiyor",
    `Bellek: ${
      device?.memoryFreeBytes !== undefined
        ? `${formatBytes(device.memoryFreeBytes)} boş / ${formatBytes(device.memoryTotalBytes ?? 0)}`
        : "bilinmiyor"
    }`,
    `Kitaplık: ${entries.length} dosya · ${trashed.length} çöp · ${hidden.length} gizli`,
    `FFmpeg: ${ffmpeg === "ok" ? `yüklendi (${ffmpegMs} ms)` : ffmpeg === "fail" ? "yüklenemedi" : "henüz test edilmedi"}`,
    "",
    formatErrorLog(),
  ].join("\n");

  const copy = async () => {
    const ok = await copyText(report);
    setCopied(ok ? "ok" : "fail");
    window.setTimeout(() => setCopied("idle"), 1800);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("diagnostics.title")}>
      <div className="space-y-4">
        <p className="text-[12.5px] leading-[1.5] text-ink2">{t("diagnostics.note")}</p>

        <div className="rounded-[14px] bg-fill/60 px-3.5 py-1">
          <Row
            label={t("diagnostics.device")}
            value={
              device
                ? `${device.device ?? "?"} · Android ${device.android ?? "?"} (SDK ${device.sdk ?? "?"})`
                : "Web"
            }
          />
          <Row
            label={t("diagnostics.free")}
            value={
              device?.freeBytes !== undefined
                ? formatBytes(device.freeBytes)
                : quota
                  ? `${formatBytes(Math.max(0, quota.quota - quota.usage))} (${t("diagnostics.approximate")})`
                  : "—"
            }
          />
          <Row
            label={t("diagnostics.total")}
            value={
              device?.totalBytes !== undefined
                ? formatBytes(device.totalBytes)
                : quota
                  ? formatBytes(quota.quota)
                  : "—"
            }
          />
          <Row
            label={t("diagnostics.memory")}
            value={
              device?.memoryFreeBytes !== undefined
                ? `${formatBytes(device.memoryFreeBytes)} / ${formatBytes(device.memoryTotalBytes ?? 0)}`
                : "—"
            }
          />
          <Row
            label={t("diagnostics.library")}
            value={`${entries.length} · ${t("diagnostics.trash")} ${trashed.length} · ${t("diagnostics.hidden")} ${hidden.length}`}
          />
        </div>

        <div className="rounded-[14px] bg-fill/60 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">{t("diagnostics.ffmpeg")}</p>
              <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink2">
                {ffmpeg === "loading"
                  ? t("diagnostics.ffmpegLoading")
                  : ffmpeg === "ok"
                    ? t("diagnostics.ffmpegOk", { ms: String(ffmpegMs ?? 0) })
                    : ffmpeg === "fail"
                      ? t("diagnostics.ffmpegFail")
                      : t("diagnostics.ffmpegNote")}
              </p>
            </div>
            <Button
              size="sm"
              variant="gray"
              onClick={() => void testFFmpeg()}
              disabled={ffmpeg === "loading"}
            >
              {t("diagnostics.ffmpegTest")}
            </Button>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-semibold tracking-wide text-ink3 uppercase">
            {t("diagnostics.errors", { n: errors.length })}
          </p>
          <div className="no-scrollbar mt-2 max-h-[220px] space-y-2 overflow-y-auto">
            {errors.length === 0 ? (
              <p className="rounded-[10px] bg-fill px-3 py-2.5 text-[12.5px] text-ink2">
                {t("settings.errorLogEmpty")}
              </p>
            ) : (
              errors.map((entry) => (
                <div key={entry.id} className="rounded-[10px] bg-fill px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-[10.5px] text-ink3">
                    <span className="truncate">{entry.source}</span>
                    <span className="shrink-0">{new Date(entry.at).toLocaleString()}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-[1.45] break-words">{entry.message}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <Button full onClick={() => void copy()}>
          {copied === "ok"
            ? t("diagnostics.copied")
            : copied === "fail"
              ? t("diagnostics.copyFail")
              : t("diagnostics.copy")}
        </Button>
      </div>
    </Sheet>
  );
}
