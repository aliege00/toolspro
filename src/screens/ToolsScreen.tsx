import { useState } from "react";
import { motion } from "framer-motion";
import { NavBar, SectionTitle, Sheet } from "@/components/ui";
import { InfoIcon } from "@/components/Icons";
import { toolGroups } from "@/tools/registry";
import { OutputCard } from "@/tools/ToolFrame";
import { useNav } from "@/lib/nav";
import { useOutputs } from "@/lib/outputs";
import { useT } from "@/i18n";

export default function ToolsScreen() {
  const t = useT();
  const { pop, push } = useNav();
  const { outputs } = useOutputs();
  const [showOutputs, setShowOutputs] = useState(false);

  const groups = toolGroups();

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar
        title={t("tools.title")}
        subtitle={t("tools.subtitle")}
        onBack={pop}
        right={
          outputs.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowOutputs(true)}
              className="rounded-full bg-fill px-3 py-1.5 text-[13px] font-medium active:opacity-70"
            >
              {t("tools.outputs", { n: outputs.length })}
            </button>
          ) : undefined
        }
      />

      <div className="px-4 pt-2">
        {groups.map((group, groupIndex) => {
          const offset =
            groups
              .slice(0, groupIndex)
              .reduce((sum, previous) => sum + previous.items.length, 0);
          return (
            <section key={group.category}>
              <SectionTitle>{t(group.labelKey)}</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                {group.items.map((tool, i) => (
                  <motion.button
                    key={tool.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: Math.min(offset + i, 12) * 0.035,
                      type: "spring",
                      stiffness: 320,
                      damping: 26,
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => push({ name: "tool", id: tool.id })}
                    className="flex h-[132px] flex-col items-start justify-between rounded-[18px] bg-card p-4 text-left shadow-[var(--shadow-card)] active:bg-card2"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-tile text-tile-ink">
                      {tool.icon}
                    </div>
                    <div>
                      <p className="text-[15.5px] font-semibold">
                        {t(tool.titleKey)}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-[1.3] text-ink2">
                        {t(tool.descKey)}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </section>
          );
        })}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.38,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-6 flex items-start gap-2.5 rounded-[16px] bg-fill px-4 py-3.5 text-[13px] leading-[1.4] text-ink2"
        >
          <span className="mt-px shrink-0 text-ink3">
            <InfoIcon size={17} />
          </span>
          <span className="flex-1">{t("tools.offlineNote")}</span>
        </motion.div>
      </div>

      <Sheet
        open={showOutputs}
        onClose={() => setShowOutputs(false)}
        title={t("tools.outputsTitle", { n: outputs.length })}
      >
        {outputs.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-ink2">
            {t("common.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {outputs.map((output) => (
              <OutputCard key={output.id} output={output} />
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
