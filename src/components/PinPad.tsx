import { useState } from "react";
import { motion } from "framer-motion";
import { useT } from "@/i18n";
import { XMark } from "./Icons";

export default function PinPad({
  title,
  onComplete,
  onCancel,
  wrong = false,
}: {
  title: string;
  onComplete: (pin: string) => void;
  onCancel: () => void;
  wrong?: boolean;
}) {
  const t = useT();
  const [pin, setPin] = useState("");

  const press = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      window.setTimeout(() => {
        setPin("");
        onComplete(next);
      }, 180);
    }
  };

  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="safe-top safe-bottom fixed inset-0 z-[60] flex flex-col items-center bg-bg px-6"
    >
      <div className="flex w-full max-w-[340px] items-center justify-between pt-3">
        <span className="w-9" />
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 active:bg-fill"
          aria-label={t("common.cancel")}
        >
          <XMark size={20} />
        </button>
      </div>

      <p className="mt-8 text-[18px] font-semibold">{title}</p>

      <div className="mt-7 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            animate={{
              scale: pin.length > i ? 1 : 0.66,
              opacity: pin.length > i ? 1 : 0.35,
              backgroundColor: wrong && pin.length === 0 ? "var(--danger)" : undefined,
            }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="h-[15px] w-[15px] rounded-full bg-ink"
          />
        ))}
      </div>

      {wrong && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-[13.5px] text-danger"
        >
          {t("settings.pinWrong")}
        </motion.p>
      )}

      <div className="mt-auto grid w-full max-w-[300px] grid-cols-3 gap-3 pb-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map(
          (key, i) => {
            if (key === "") return <span key={`gap-${i}`} />;
            if (key === "back") {
              return (
                <button
                  key="back"
                  type="button"
                  onClick={back}
                  className="flex h-16 items-center justify-center rounded-full text-[15px] font-medium text-ink active:bg-fill"
                  aria-label="Sil"
                >
                  ←
                </button>
              );
            }
            return (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => press(key)}
                className="h-16 rounded-full bg-fill text-[26px] font-medium active:bg-tint2"
              >
                {key}
              </motion.button>
            );
          },
        )}
      </div>
    </motion.div>
  );
}
