import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { App as CapacitorApp } from "@capacitor/app";
import { Button } from "@/components/ui";
import { FolderIcon, ShieldIcon, VideoIcon, WrenchIcon } from "@/components/Icons";
import {
  checkMediaAccess,
  isNative,
  openAppSettings,
  requestMediaAccess,
} from "@/lib/native";
import { useT } from "@/i18n";

type Status = "idle" | "requesting" | "granted" | "denied";

const rows = [
  {
    key: "video",
    icon: <VideoIcon size={22} />,
    titleKey: "onboarding.rowVideo.title",
    descKey: "onboarding.rowVideo.desc",
  },
  {
    key: "files",
    icon: <FolderIcon size={22} />,
    titleKey: "onboarding.rowFiles.title",
    descKey: "onboarding.rowFiles.desc",
  },
  {
    key: "tools",
    icon: <WrenchIcon size={22} />,
    titleKey: "onboarding.rowTools.title",
    descKey: "onboarding.rowTools.desc",
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status !== "granted") return;
    const timer = window.setTimeout(onDone, 1100);
    return () => window.clearTimeout(timer);
  }, [status, onDone]);

  // Android'de daha önce izin verilmişse ekranı boşuna gösterme.
  useEffect(() => {
    if (!isNative()) return;
    let alive = true;
    void checkMediaAccess().then((granted) => {
      if (alive && granted) setStatus("granted");
    });
    return () => {
      alive = false;
    };
  }, []);

  // Kullanıcı Ayarlar'dan dönünce durumu yeniden oku; eski "reddedildi"
  // yazısı izin verilmiş olsa bile ekranda kalıyordu.
  useEffect(() => {
    if (!isNative()) return;
    let disposed = false;
    let handle: { remove: () => Promise<void> } | undefined;
    void CapacitorApp.addListener("resume", () => {
      void checkMediaAccess().then((granted) => {
        if (granted && !disposed) setStatus("granted");
      });
    }).then((listener) => {
      if (disposed) void listener.remove();
      else handle = listener;
    });
    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, []);

  const request = async () => {
    setStatus("requesting");
    const granted = await requestMediaAccess();
    setStatus(granted ? "granted" : "denied");
  };

  return (
    <div className="safe-top safe-bottom flex h-full flex-col overflow-y-auto no-scrollbar px-6">
      <div className="flex flex-1 flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="mb-7 flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-tile text-tile-ink"
        >
          <ShieldIcon size={38} strokeWidth={1.6} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="text-[32px] leading-[1.1] font-bold"
        >
          {t("onboarding.title")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 text-[15px] leading-[1.5] text-ink2"
        >
          {t("onboarding.desc")}
        </motion.p>

        <div className="mt-7 space-y-2.5">
          {rows.map((row, i) => (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.18 + i * 0.08,
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex items-center gap-3.5 rounded-[16px] bg-card px-4 py-3.5 shadow-[var(--shadow-card)]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-tile text-tile-ink">
                {row.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[16px] font-semibold">{t(row.titleKey)}</p>
                <p className="truncate text-[13px] text-ink2">{t(row.descKey)}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {!isNative() && (
          <p className="mt-5 text-[12px] leading-[1.4] text-ink3">
            {t("onboarding.browserNote")}
          </p>
        )}

        {status === "denied" && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-[13px] leading-[1.45] text-danger"
          >
            {t("onboarding.denied")}
          </motion.p>
        )}
      </div>

      <div className="mt-8 space-y-2.5">
        {status !== "granted" && (
          <>
            <Button full loading={status === "requesting"} onClick={request}>
              {status === "denied" ? t("onboarding.retry") : t("onboarding.grant")}
            </Button>
            {status === "denied" && (
              <Button full variant="secondary" onClick={() => void openAppSettings()}>
                {t("onboarding.openSettings")}
              </Button>
            )}
            <Button full variant="gray" onClick={onDone}>
              {t("onboarding.skip")}
            </Button>
          </>
        )}
      </div>

      {status === "granted" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-bg"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className="text-success"
          >
            <svg width="84" height="84" viewBox="0 0 52 52" fill="none">
              <motion.circle
                cx="26"
                cy="26"
                r="23"
                stroke="currentColor"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
              <motion.path
                d="M15.5 26.5l7.5 7.5 14-15"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-4 text-[17px] font-semibold"
          >
            {t("onboarding.ready")}
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}
