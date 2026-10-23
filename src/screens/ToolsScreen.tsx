import { useState } from "react";
import { motion } from "framer-motion";
import { NavBar, Sheet } from "@/components/ui";
import { ChevronRight } from "@/components/Icons";
import { tools } from "@/tools/registry";
import { OutputCard } from "@/tools/ToolFrame";
import { useNav } from "@/lib/nav";
import { useOutputs } from "@/lib/outputs";

export default function ToolsScreen() {
  const { pop, push } = useNav();
  const { outputs } = useOutputs();
  const [showOutputs, setShowOutputs] = useState(false);

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar
        title="Araçlar"
        subtitle="Çevrimdışı çalışır"
        onBack={pop}
        right={
          outputs.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowOutputs(true)}
              className="rounded-full bg-fill px-3 py-1.5 text-[13px] font-medium active:opacity-70"
            >
              Çıktılar · {outputs.length}
            </button>
          ) : undefined
        }
      />

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {tools.map((tool, i) => (
            <motion.button
              key={tool.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.05,
                duration: 0.38,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => push({ name: "tool", id: tool.id })}
              className="flex h-[132px] flex-col items-start justify-between rounded-[18px] bg-card p-4 text-left shadow-[var(--shadow-card)] active:bg-card2"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-tint2 text-tint">
                {tool.icon}
              </div>
              <div>
                <p className="text-[15.5px] font-semibold">{tool.title}</p>
                <p className="mt-0.5 text-[12px] leading-[1.3] text-ink2">
                  {tool.desc}
                </p>
              </div>
            </motion.button>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: tools.length * 0.05,
              duration: 0.38,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="col-span-2 flex items-center gap-2 rounded-[16px] bg-fill px-4 py-3.5 text-[13px] leading-[1.4] text-ink2"
          >
            <span className="flex-1">
              Dönüşümler cihazının işlemcisinde, internete yüklenmeden yapılır.
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink3" />
          </motion.div>
        </div>
      </div>

      <Sheet
        open={showOutputs}
        onClose={() => setShowOutputs(false)}
        title={`Çıktılar (${outputs.length})`}
      >
        {outputs.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-ink2">
            Henüz çıktı yok.
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
