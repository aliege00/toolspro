import { NavBar } from "@/components/ui";
import { toolById } from "@/tools/registry";
import { useNav } from "@/lib/nav";

export default function ToolScreen({ id, fileId }: { id: string; fileId?: string }) {
  const { pop } = useNav();
  const tool = toolById(id);

  if (!tool) {
    return (
      <div className="safe-bottom min-h-full">
        <NavBar title="Araç" onBack={pop} />
        <p className="px-6 py-10 text-center text-[14px] text-ink2">
          Bu araç bulunamadı.
        </p>
      </div>
    );
  }

  const ToolComponent = tool.component;

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar title={tool.title} subtitle={tool.desc} onBack={pop} />
      <div className="space-y-5 px-4 pt-4">
        <ToolComponent initialFileId={fileId} />
        <p className="pt-2 text-center text-[12px] leading-[1.4] text-ink3">
          Dosyaların cihazından çıkmaz; işlem tamamen yerelde yapılır.
        </p>
      </div>
    </div>
  );
}
