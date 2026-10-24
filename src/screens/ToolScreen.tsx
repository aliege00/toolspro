import { NavBar } from "@/components/ui";
import { toolById } from "@/tools/registry";
import { useNav } from "@/lib/nav";
import { useT } from "@/i18n";

export default function ToolScreen({ id, fileId }: { id: string; fileId?: string }) {
  const t = useT();
  const { pop } = useNav();
  const tool = toolById(id);

  if (!tool) {
    return (
      <div className="safe-bottom min-h-full">
        <NavBar title={t("tools.title")} onBack={pop} />
        <p className="px-6 py-10 text-center text-[14px] text-ink2">
          {t("tools.notFound")}
        </p>
      </div>
    );
  }

  const ToolComponent = tool.component;

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar title={t(tool.titleKey)} subtitle={t(tool.descKey)} onBack={pop} />
      <div className="space-y-5 px-4 pt-4">
        <ToolComponent initialFileId={fileId} />
        <p className="pt-2 text-center text-[12px] leading-[1.4] text-ink3">
          {t("tools.localNote")}
        </p>
      </div>
    </div>
  );
}
