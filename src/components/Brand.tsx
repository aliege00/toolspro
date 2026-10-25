import { useId } from "react";
import { motion } from "framer-motion";

/**
 * Mat, iOS tarzı uygulama işareti: koyu grafit karo + fildişi play glifi.
 * Neon yok; yalnızca yumuşak gradyan ve ince kenar.
 */
export function BeyToolMark({
  size = 40,
  radius,
  className = "",
}: {
  size?: number;
  radius?: number;
  className?: string;
}) {
  const id = useId();
  const r = radius ?? size * 0.235;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2D2D30" />
          <stop offset="1" stopColor="#19191C" />
        </linearGradient>
        <linearGradient id={`${id}-glyph`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2EFE8" />
          <stop offset="1" stopColor="#E4E0D7" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx={(r / size) * 100}
        fill={`url(#${id}-bg)`}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.8"
      />
      <rect
        x="9"
        y="6"
        width="82"
        height="44"
        rx={(r / size) * 72}
        fill="rgba(255,255,255,0.028)"
      />
      <path
        d="M40.2 30.6c0-1.9 2.1-3.1 3.8-2.1l18.7 11.9c1.6 1 1.6 3.3 0 4.3L44 56.6c-1.7 1-3.8-.2-3.8-2.1z"
        fill={`url(#${id}-glyph)`}
      />
    </svg>
  );
}

/** Kısa, dürüst açılış animasyonu; yükleme taklidi yapmaz. */
export function LaunchScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.86, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
        className="relative"
      >
        <BeyToolMark size={96} />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 text-[22px] font-semibold tracking-[0.01em]"
      >
        BeyTool
      </motion.p>

      <motion.span
        initial={{ opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.32, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 h-[3px] w-9 rounded-full bg-ink3"
      />
    </motion.div>
  );
}
