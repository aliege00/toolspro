import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, NavBar, Segmented, Toggle } from "@/components/ui";
import PinPad from "@/components/PinPad";
import { Moon, Sun } from "@/components/Icons";
import { useI18n, useT } from "@/i18n";
import type { Lang } from "@/i18n";
import { useNav } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { clearPin, hasPin, setPin, verifyPin } from "@/lib/security";

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

type Flow = "create" | "change" | "remove";

export default function Settings() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const { theme, toggle, accent, setAccent } = useTheme();
  const { pop } = useNav();

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
        <section>
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
        </section>

        <section className="mt-6">
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
        </section>

        <section className="mt-6">
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
        </section>

        <section className="mt-6">
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
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">
            {t("settings.about")}
          </h2>
          <div className="rounded-[16px] bg-card px-4 py-3.5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between text-[15.5px]">
              <span>Medya</span>
              <span className="text-ink2">{APP_VERSION}</span>
            </div>
          </div>
          <p className="mt-2.5 px-1 text-[12.5px] leading-[1.45] text-ink3">
            {t("settings.note")}
          </p>
        </section>
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
