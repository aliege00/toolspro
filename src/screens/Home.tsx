import { motion } from "framer-motion";
import { Toggle } from "@/components/ui";
import {
  ChevronRight,
  FolderIcon,
  Moon,
  Sun,
  VideoIcon,
  WrenchIcon,
} from "@/components/Icons";
import { useNav } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { useOutputs } from "@/lib/outputs";

const entries = [
  {
    route: "video" as const,
    icon: <VideoIcon size={26} />,
    title: "Video Oynat",
    desc: "Cihazındaki videoları oynat, hız ve tam ekran kontrolü",
  },
  {
    route: "files" as const,
    icon: <FolderIcon size={26} />,
    title: "Dosyalar",
    desc: "Galeri gibi göz at, görüntü ve sesi önizle",
  },
  {
    route: "tools" as const,
    icon: <WrenchIcon size={26} />,
    title: "Araçlar",
    desc: "MP3 çıkarma, sıkıştırma, arşiv ve daha fazlası",
  },
];

const stagger = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 + i * 0.09, type: "spring" as const, stiffness: 300, damping: 26 },
  }),
};

export default function Home() {
  const { push } = useNav();
  const { theme, toggle } = useTheme();
  const { outputs } = useOutputs();

  return (
    <div className="safe-top safe-bottom min-h-full px-5 pb-10">
      <div className="flex items-start justify-between pt-4 pb-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-[34px] leading-[1.05] font-bold"
          >
            Medya
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1 text-[15px] text-ink2"
          >
            Oynat, göz at, dönüştür
          </motion.p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <span className="text-ink2">
            {theme === "dark" ? <Moon size={19} /> : <Sun size={19} />}
          </span>
          <Toggle checked={theme === "dark"} onChange={toggle} label="Koyu mod" />
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
            whileTap={{ scale: 0.975 }}
            onClick={() => push({ name: entry.route })}
            className="flex w-full items-center gap-4 rounded-[20px] bg-card px-4 py-4 text-left shadow-[var(--shadow-card)] active:bg-card2"
          >
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-tint2 text-tint">
              {entry.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-semibold">{entry.title}</p>
              <p className="mt-0.5 text-[13.5px] leading-[1.35] text-ink2">
                {entry.desc}
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
          <span>Araç çıktıları</span>
          <span className="text-ink2">{outputs.length} dosya</span>
        </motion.button>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 text-center text-[12px] text-ink3"
      >
        Tüm işlemler cihazında, çevrimdışı yapılır
      </motion.p>
    </div>
  );
}
