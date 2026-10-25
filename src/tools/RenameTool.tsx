import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button, Segmented } from "@/components/ui";
import { ToolSection } from "./ToolFrame";
import { formatBytes } from "@/lib/files";
import { useLibrary } from "@/lib/library";
import { applyAliases, clearAliases, getAliases } from "@/lib/rename";
import { useT } from "@/i18n";

function stampOf(lastModified: number): string {
  const d = new Date(lastModified);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i);
}

export default function RenameTool() {
  const t = useT();
  const { entries, hidden } = useLibrary();
  const [prefix, setPrefix] = useState("medya");
  const [start, setStart] = useState(1);
  const [mode, setMode] = useState<"seq" | "date">("seq");
  const [toast, setToast] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  const files = useMemo(
    () => entries.filter((e) => !hidden.includes(e.key)).slice(0, 500),
    [entries, hidden],
  );

  const plan = useMemo(() => {
    const map: Record<string, string> = {};
    files.forEach((entry, i) => {
      const ext = extOf(entry.name);
      const base = prefix.trim() || "dosya";
      const next =
        mode === "seq"
          ? `${base}_${String(start + i).padStart(3, "0")}${ext}`
          : `${base}_${stampOf(entry.file.lastModified)}_${String(start + i).padStart(2, "0")}${ext}`;
      map[entry.key] = next;
    });
    return map;
  }, [files, prefix, start, mode]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const apply = () => {
    applyAliases(plan);
    forceRender((n) => n + 1);
    showToast(t("rename.done", { n: files.length }));
  };

  const reset = () => {
    clearAliases();
    forceRender((n) => n + 1);
  };

  const aliases = getAliases();

  return (
    <div className="space-y-5">
      <ToolSection title={t("section.settings")}>
        <div className="space-y-4">
          <Segmented
            layoutId="rename-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "seq", label: t("rename.seq") },
              { value: "date", label: t("rename.date") },
            ]}
          />
          <label className="block">
            <span className="mb-1.5 block text-[14px] text-ink2">{t("rename.prefix")}</span>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="h-11 w-full rounded-[12px] bg-fill px-4 text-[15px] outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] text-ink2">{t("rename.start")}</span>
            <input
              type="number"
              min={0}
              value={start}
              onChange={(e) => setStart(Math.max(0, Number(e.target.value)))}
              className="h-11 w-full rounded-[12px] bg-fill px-4 text-[15px] outline-none"
            />
          </label>
          <p className="text-[12.5px] leading-[1.45] text-ink2">{t("rename.note")}</p>
        </div>
      </ToolSection>

      <ToolSection title={t("rename.preview")}>
        {files.length === 0 ? (
          <p className="py-3 text-center text-[14px] text-ink2">{t("files.emptyTitle")}</p>
        ) : (
          <div className="max-h-[320px] space-y-2 overflow-y-auto no-scrollbar">
            {files.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center gap-2 rounded-[10px] bg-fill px-3 py-2 text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate text-ink2 line-through decoration-ink3">
                  {entry.name}
                </span>
                <span className="shrink-0 text-ink3">→</span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {plan[entry.key]}
                </span>
                <span className="shrink-0 text-[11.5px] text-ink3">
                  {formatBytes(entry.size)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ToolSection>

      <div className="space-y-2">
        <Button full onClick={apply} disabled={files.length === 0}>
          {t("rename.apply")}
        </Button>
        <Button
          full
          variant="gray"
          disabled={Object.keys(aliases).length === 0}
          onClick={reset}
        >
          {t("rename.reset")}
        </Button>
      </div>

      {toast && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[12px] bg-fill px-4 py-3 text-center text-[14px] font-medium text-ink2"
        >
          {toast}
        </motion.p>
      )}
    </div>
  );
}
