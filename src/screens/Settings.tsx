import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, NavBar, ProgressBar, Segmented, Toggle } from "@/components/ui";
import PinPad from "@/components/PinPad";
import { Moon, Sun } from "@/components/Icons";
import { useI18n, useT } from "@/i18n";
import type { Lang } from "@/i18n";
import { useNav } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { clearPin, hasPin, setPin, verifyPin } from "@/lib/security";
import { formatBytes } from "@/lib/files";
import { isNative } from "@/lib/native";
import { usePacks } from "@/packs/PacksProvider";

export const ACCENTS: { id: string; label: string; swatch: string }[] = [
  { id: "blue", label: "Mavi", swatch: "#007aff" },
  { id: "indigo", label: "Çivit", swatch: "#5856d6" },
  { id: "teal", label: "Turkuaz", swatch: "#30b0c7" },
  { id: "green", label: "Yeşil", swatch: "#34c759" },
  { id: "orange", label: "Turuncu", swatch: "#ff9500" },
  { id: "pink", label: "Pembe", swatch: "#ff2d55" },
  { id: "red", label: "Kırmızı", swatch: "#ff3b30" },
  { id: "graphite", label: "Grafit", swatch: "#6e6e73" },
];

const APP_VERSION = "1.0.0";

function rise(index: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: 0.03 + index * 0.05,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

type Flow = "create" | "change" | "remove";

export default function Settings() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const { theme, toggle, accent, setAccent } = useTheme();
  const { pop } = useNav();
  const {
    available: packCatalog,
    packs: installedPacks,
    active: packDownload,
    error: packError,
    install: installPack,
    remove: removePack,
    cancel: cancelPack,
    clearError: clearPackError,
  } = usePacks();

  const [confirmPack, setConfirmPack] = useState<string | null>(null);
  const [confirmRemovePack, setConfirmRemovePack] = useState<string | null>(null);

  const [pinFlow, setPinFlow] = useState<Flow | null>(null);
  const [needVerify, setNeedVerify] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pinExists = hasPin();

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  };

  const startFlow = (flow: Flow) => {
    setWrong(false);
    setPinFlow(flow);
    setNeedVerify(flow !== "create");
  };

  const onPinComplete = async (pin: string) => {
    if (needVerify) {
      const ok = await verifyPin(pin);
      if (!ok) {
        setWrong(true);
        return;
      }
      if (pinFlow === "remove") {
        clearPin();
        setPinFlow(null);
        setNeedVerify(false);
        showToast(t("settings.pinRemoved"));
        return;
      }
      setNeedVerify(false);
      setWrong(false);
      return;
    }

    await setPin(pin);
    setPinFlow(null);
    setWrong(false);
    showToast(t("settings.pinSaved"));
  };

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar title={t("settings.title")} onBack={pop} />

      <div className="px-4 pt-4">
        <motion.section {...rise(0)}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
            {t("settings.language")}
          </h2>
          <div className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]">
            <Segmented
              layoutId="settings-lang"
              value={lang}
              onChange={(next: Lang) => setLang(next)}
              options={[
                { value: "tr", label: "Türkçe" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
        </motion.section>

        <motion.section className="mt-6" {...rise(1)}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
            {t("settings.accent")}
          </h2>
          <div className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap justify-between gap-3">
              {ACCENTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAccent(item.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
                  style={{ backgroundColor: `${item.swatch}22` }}
                  aria-label={item.label}
                >
                  <motion.span
                    animate={{
                      scale: accent === item.id ? 1 : 0.72,
                      opacity: accent === item.id ? 1 : 0.55,
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: item.swatch }}
                  />
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section className="mt-6" {...rise(2)}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
            {t("settings.darkMode")}
          </h2>
          <div className="flex items-center justify-between rounded-[16px] bg-card px-4 py-3.5 shadow-[var(--shadow-card)]">
            <span className="flex items-center gap-2.5 text-[16px]">
              {theme === "dark" ? <Moon size={19} /> : <Sun size={19} />}
              {t("settings.darkMode")}
            </span>
            <Toggle checked={theme === "dark"} onChange={toggle} label={t("settings.darkMode")} />
          </div>
        </motion.section>

        <motion.section className="mt-6" {...rise(3)}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
            {t("settings.hidden")}
          </h2>
          <div className="overflow-hidden rounded-[16px] bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 text-[15.5px]">
              <span>{t("settings.pin")}</span>
              <span className="text-[13.5px] text-ink2">
                {pinExists ? "••••" : "—"}
              </span>
            </div>
            <div className="space-y-2 border-t border-line p-3">
              <Button
                full
                size="md"
                variant={pinExists ? "gray" : "primary"}
                onClick={() => startFlow(pinExists ? "change" : "create")}
              >
                {pinExists ? t("settings.pinChange") : t("settings.pinSet")}
              </Button>
              {pinExists && (
                <Button full size="md" variant="ghost" onClick={() => startFlow("remove")}>
                  {t("settings.pinRemove")}
                </Button>
              )}
            </div>
            <p className="border-t border-line px-4 py-3 text-[12px] leading-[1.5] text-ink2">
              {t("settings.hiddenNote")}
            </p>
            <p className="border-t border-line px-4 py-3 text-[12px] leading-[1.5] text-ink3">
              {t("settings.libraryNote")}
            </p>
          </div>
        </motion.section>

        <motion.section className="mt-6" {...rise(4)}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
            {t("settings.packs")}
          </h2>
          <div className="rounded-[16px] bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="text-[12.5px] leading-[1.5] text-ink2">{t("settings.packsNote")}</p>
            {!isNative() && (
              <p className="mt-1.5 text-[11px] leading-[1.45] text-ink3">
                {t("settings.packsBrowserNote")}
              </p>
            )}

            {installedPacks.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink3 uppercase">
                  {t("settings.installedPacks")}
                </p>
                <div className="space-y-2">
                  {installedPacks.map((pack) => (
                    <div key={pack.id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">
                          {pack.title[lang] || pack.title.tr}
                        </p>
                        <p className="text-[11px] text-ink3">
                          {t("settings.packVersion", { v: pack.version })} · {pack.license}
                        </p>
                      </div>
                      {confirmRemovePack === pack.id ? (
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmRemovePack(null);
                              void removePack(pack.id);
                            }}
                            className="rounded-[8px] bg-fill px-2.5 py-1.5 text-[11px] font-medium text-danger"
                          >
                            {t("settings.packDeleteConfirm")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemovePack(null)}
                            className="rounded-[8px] bg-fill px-2.5 py-1.5 text-[11px] text-ink2"
                          >
                            {t("settings.packCancel")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemovePack(pack.id)}
                          className="shrink-0 rounded-[8px] bg-fill px-2.5 py-1.5 text-[11px] font-medium text-ink2"
                        >
                          {t("settings.packDelete")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink3 uppercase">
                {t("settings.availablePacks")}
              </p>
              <div className="space-y-3">
                {packCatalog.map((pack) => {
                  const installed = installedPacks.some((item) => item.id === pack.id);
                  const downloading = packDownload?.packId === pack.id;
                  const confirming = confirmPack === pack.id;
                  if (installed) return null;
                  return (
                    <div key={pack.id} className="rounded-[12px] bg-fill/60 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium">{pack.title[lang]}</p>
                          <p className="mt-0.5 text-[11.5px] leading-[1.45] text-ink2">
                            {pack.description[lang]}
                          </p>
                          <p className="mt-1 text-[10.5px] text-ink3">
                            {t("settings.packVersion", { v: pack.version })} · {formatBytes(pack.size)} ·{" "}
                            {pack.license}
                          </p>
                        </div>
                        {!confirming && !downloading && (
                          <button
                            type="button"
                            onClick={() => {
                              clearPackError();
                              setConfirmPack(pack.id);
                            }}
                            className="shrink-0 rounded-[8px] bg-card px-2.5 py-1.5 text-[11.5px] font-semibold text-ink"
                          >
                            {t("settings.packDownload")}
                          </button>
                        )}
                      </div>

                      {confirming && !downloading && (
                        <div className="mt-2 border-t border-line pt-2">
                          <p className="text-[11.5px] leading-[1.45] text-ink2">
                            {t("settings.packConfirm", {
                              size: formatBytes(pack.size),
                              license: pack.license,
                            })}
                          </p>
                          <p className="mt-1 truncate text-[10.5px] text-ink3">
                            {t("settings.packSource")}: GitHub Releases · {pack.source}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setConfirmPack(null);
                                void installPack(pack);
                              }}
                            >
                              {t("settings.packDownload")}
                            </Button>
                            <Button
                              size="sm"
                              variant="gray"
                              onClick={() => setConfirmPack(null)}
                            >
                              {t("settings.packCancel")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {downloading && (
                        <div className="mt-2 space-y-1.5">
                          <ProgressBar
                            ratio={
                              packDownload.total > 0
                                ? packDownload.received / packDownload.total
                                : 0
                            }
                          />
                          <div className="flex items-center justify-between text-[11px] text-ink2">
                            <span>
                              {t("settings.packDownloading")} · %
                              {packDownload.total > 0
                                ? Math.round(
                                    (packDownload.received / packDownload.total) * 100,
                                  )
                                : 0}
                            </span>
                            <button
                              type="button"
                              onClick={cancelPack}
                              className="font-medium text-danger"
                            >
                              {t("settings.packCancel")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {packError && (
              <p className="mt-3 rounded-[10px] bg-fill px-3 py-2 text-[11.5px] leading-[1.45] text-danger">
                {packError === "network"
                  ? t("packs.network")
                  : packError === "browser"
                    ? t("packs.browser")
                    : packError === "hash"
                      ? t("packs.hash")
                      : packError === "cancelled"
                        ? t("packs.cancelled")
                        : t("packs.failed")}
              </p>
            )}
          </div>
        </motion.section>

        <motion.section className="mt-6" {...rise(5)}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
            {t("settings.about")}
          </h2>
          <div className="rounded-[16px] bg-card px-4 py-3.5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-[15.5px]">
              <span>BeyTool</span>
              <span className="text-ink2">{APP_VERSION}</span>
            </div>
          </div>
          <p className="mt-2.5 px-1 text-[12.5px] leading-[1.45] text-ink3">
            {t("settings.note")}
          </p>
        </motion.section>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-0 bottom-10 z-[70] flex justify-center"
          >
            <span className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg shadow-lg">
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pinFlow && (
          <PinPad
            key={pinFlow + String(needVerify)}
            title={
              needVerify
                ? t("settings.pinVerify")
                : t("settings.pinEnter")
            }
            wrong={wrong}
            onComplete={(pin) => void onPinComplete(pin)}
            onCancel={() => {
              setPinFlow(null);
              setNeedVerify(false);
              setWrong(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
