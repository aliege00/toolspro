import { motion } from "framer-motion";
import { Toggle } from "@/components/ui";
import { MedyaMark } from "@/components/Brand";
import {
  ChevronRight,
  FolderIcon,
  Moon,
  SettingsIcon,
  Sun,
  VideoIcon,
  WrenchIcon,
} from "@/components/Icons";
import { useNav } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { useOutputs } from "@/lib/outputs";
import { useT } from "@/i18n";

const entries: {
  route: "video" | "files" | "tools";
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
}[] = [
  {
    route: "video",
    icon: <VideoIcon size={26} />,
    titleKey: "home.video.title",
    descKey: "home.video.desc",
  },
  {
    route: "files",
    icon: <FolderIcon size={26} />,
    titleKey: "home.files.title",
    descKey: "home.files.desc",
  },
  {
    route: "tools",
    icon: <WrenchIcon size={26} />,
    titleKey: "home.tools.title",
    descKey: "home.tools.desc",
  },
];

const stagger = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.06 + i * 0.09,
      type: "spring" as const,
      stiffness: 300,
      damping: 26,
    },
  }),
};

export default function Home() {
  const t = useT();
  const { push } = useNav();
  const { theme, toggle } = useTheme();
  const { outputs } = useOutputs();

  return (
    <div className="safe-top safe-bottom relative min-h-full overflow-hidden px-5 pb-10">
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-tint2 blur-3xl"
      />

      <div className="relative flex items-start justify-between pt-4 pb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <motion.div
              initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <MedyaMark size={40} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-[34px] leading-[1.05] font-bold"
            >
              Medya
            </motion.h1>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1 text-[15px] text-ink2"
          >
            {t("home.tagline")}
          </motion.p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => push({ name: "settings" })}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink2 active:bg-card"
            aria-label={t("home.settings")}
          >
            <SettingsIcon size={19} />
          </motion.button>
          <span className="text-ink2">
            {theme === "dark" ? <Moon size={19} /> : <Sun size={19} />}
          </span>
          <Toggle checked={theme === "dark"} onChange={toggle} label={t("home.darkMode")} />
        </div>
      </div>

      <div className="space-y-3.5">
        {entries.map((entry, i) => (
          <motion.button
            key={entry.route}
            type="button"
            custom={i}
            variants={stagger}
            initial="hidden"
            animate="show"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.975 }}
            onClick={() => push({ name: entry.route })}
            className="flex w-full items-center gap-4 rounded-[20px] bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] active:bg-card2"
          >
            <motion.div
              variants={{
                hidden: { scale: 0.9, opacity: 0 },
                show: { scale: 1, opacity: 1 },
              }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-tint2 text-tint"
            >
              {entry.icon}
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-semibold">{t(entry.titleKey)}</p>
              <p className="mt-0.5 text-[13.5px] leading-[1.35] text-ink2">
                {t(entry.descKey)}
              </p>
            </div>
            <span className="text-ink3">
              <ChevronRight size={22} strokeWidth={2.2} />
            </span>
          </motion.button>
        ))}
      </div>

      {outputs.length > 0 && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 26 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => push({ name: "tools" })}
          className="mt-4 flex w-full items-center justify-between rounded-[16px] bg-fill px-4 py-3 text-[15px] font-medium active:opacity-70"
        >
          <span>{t("home.outputs")}</span>
          <span className="text-ink2">
            {t("home.outputsCount", { n: outputs.length })}
          </span>
        </motion.button>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 flex items-center justify-center gap-1.5 text-[12px] text-ink3"
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-success"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {t("home.offline")}
      </motion.div>
    </div>
  );
}
