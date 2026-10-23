import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Chip, EmptyState, NavBar, ProgressBar, Sheet } from "@/components/ui";
import Thumb from "@/components/Thumb";
import {
  FileIcon,
  FolderIcon,
  ImageIcon,
  MusicIcon,
  Play,
  XMark,
} from "@/components/Icons";
import {
  formatDate,
  formatBytes,
  pickFiles,
} from "@/lib/files";
import type { Kind } from "@/lib/files";
import { useLibrary } from "@/lib/library";
import type { Entry } from "@/lib/library";
import { useNav } from "@/lib/nav";
import { sha256Hex } from "@/lib/media";

type Filter = "all" | Kind;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "video", label: "Videolar" },
  { value: "image", label: "Görseller" },
  { value: "audio", label: "Ses" },
  { value: "other", label: "Diğer" },
];

const kindLabels: Record<Kind, string> = {
  video: "Video",
  image: "Görsel",
  audio: "Ses dosyası",
  other: "Dosya",
};

export default function FilesScreen() {
  const { pop, push } = useNav();
  const { entries, addFiles } = useLibrary();
  const [filter, setFilter] = useState<Filter>("all");
  const [lightbox, setLightbox] = useState<Entry | null>(null);
  const [audio, setAudio] = useState<Entry | null>(null);
  const [info, setInfo] = useState<Entry | null>(null);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: 0, video: 0, image: 0, audio: 0, other: 0 };
    for (const e of entries) {
      base.all += 1;
      base[e.kind] += 1;
    }
    return base;
  }, [entries]);

  const visible = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.kind === filter)),
    [entries, filter],
  );

  const totalSize = useMemo(
    () => visible.reduce((sum, e) => sum + e.size, 0),
    [visible],
  );

  const addFromPicker = async (directory: boolean) => {
    const files = await pickFiles({ multiple: true, directory });
    if (files.length > 0) addFiles(files);
  };

  const open = (entry: Entry) => {
    if (entry.kind === "image") setLightbox(entry);
    else if (entry.kind === "audio") setAudio(entry);
    else if (entry.kind === "video") push({ name: "video", fileId: entry.id });
    else setInfo(entry);
  };

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar
        title="Dosyalar"
        subtitle={entries.length > 0 ? `${entries.length} öğe` : undefined}
        onBack={pop}
      />

      <div className="px-4 pt-4">
        <div className="flex gap-2.5">
          <Button size="md" variant="secondary" className="flex-1" onClick={() => addFromPicker(true)}>
            <FolderIcon size={18} />
            Klasör Seç
          </Button>
          <Button size="md" variant="gray" className="flex-1" onClick={() => addFromPicker(false)}>
            <ImageIcon size={18} />
            Dosya Ekle
          </Button>
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          {filters.map((f) => (
            <Chip
              key={f.value}
              active={filter === f.value}
              count={counts[f.value]}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>

        {visible.length > 0 && (
          <p className="mt-3 text-[12.5px] text-ink2">
            {visible.length} öğe · {formatBytes(totalSize)}
          </p>
        )}

        {visible.length === 0 ? (
          <EmptyState
            icon={<FolderIcon size={30} />}
            title="Burada henüz dosya yok"
            description="Klasör seçerek galeri gibi göz atabilir veya tek tek dosya ekleyebilirsin."
          >
            <div className="space-y-2">
              <Button full onClick={() => addFromPicker(true)}>
                Klasör Seç
              </Button>
              <Button full variant="gray" onClick={() => addFromPicker(false)}>
                Dosya Ekle
              </Button>
            </div>
          </EmptyState>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-[6px]">
            {visible.map((entry, i) => (
              <motion.button
                key={entry.id}
                type="button"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: Math.min(i, 15) * 0.02,
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => open(entry)}
                className="relative aspect-square overflow-hidden rounded-[12px] bg-fill"
              >
                {entry.kind === "image" ? (
                  <motion.div
                    layoutId={`cell-${entry.id}`}
                    className="h-full w-full"
                  >
                    <img
                      src={entry.url}
                      alt={entry.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </motion.div>
                ) : entry.kind === "video" ? (
                  <Thumb entry={entry} />
                ) : entry.kind === "audio" ? (
                  <div className="flex h-full w-full items-center justify-center bg-tint2 text-tint">
                    <MusicIcon size={30} />
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink2">
                    <FileIcon size={26} />
                    <span className="px-1 text-[10px] font-medium break-all">
                      {entry.name.split(".").pop()?.slice(0, 8) ?? "dosya"}
                    </span>
                  </div>
                )}

                {entry.kind === "video" && (
                  <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
                    <Play size={12} />
                  </span>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-left text-[9.5px] text-white/90">
                  {entry.name}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {lightbox && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightbox(null)}
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3">
              <motion.img
                layoutId={`cell-${lightbox.id}`}
                src={lightbox.url}
                alt={lightbox.name}
                className="max-h-[78vh] max-w-full rounded-[16px] object-contain"
              />
            </div>
            <motion.div
              className="safe-bottom fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 px-5 pb-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-white">
                  {lightbox.name}
                </p>
                <p className="text-[12px] text-white/60">
                  {formatBytes(lightbox.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25"
                aria-label="Kapat"
              >
                <XMark size={20} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Sheet open={!!audio} onClose={() => setAudio(null)} title="Ses Önizleme">
        {audio && (
          <div>
            <p className="mb-1 truncate text-[16px] font-semibold">{audio.name}</p>
            <p className="mb-4 text-[13px] text-ink2">
              {formatBytes(audio.size)} · {kindLabels[audio.kind]}
            </p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={audio.url} controls className="w-full" autoPlay />
          </div>
        )}
      </Sheet>

      <FileSheet entry={info} onClose={() => setInfo(null)} />
    </div>
  );
}

function FileSheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setHash(null);
    setError(null);
    setProgress(0);
    setCopied(false);
  };

  const compute = async () => {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const result = await sha256Hex(entry.file, setProgress);
      setHash(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hesaplanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Sheet
      open={!!entry}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Dosya Özeti"
    >
      {entry && (
        <div>
          <p className="mb-4 text-[15px] break-all">{entry.name}</p>
          <div className="overflow-hidden rounded-[14px]">
            {[
              ["Tür", kindLabels[entry.kind]],
              ["Boyut", formatBytes(entry.size)],
              ["İçerik türü", entry.file.type || "bilinmiyor"],
              ["Değiştirilme", formatDate(entry.file.lastModified)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 bg-fill px-4 py-3 text-[14px]"
              >
                <span className="text-ink2">{label}</span>
                <span className="truncate font-medium">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {!hash && (
              <Button full variant="secondary" loading={busy} onClick={compute}>
                SHA-256 Parmak İzi Hesapla
              </Button>
            )}
            {busy && <ProgressBar ratio={progress} />}
            {error && <p className="text-[13px] text-danger">{error}</p>}
            {hash && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[14px] bg-fill p-4"
              >
                <p className="mb-1.5 text-[12px] font-semibold text-ink2 uppercase">
                  SHA-256
                </p>
                <p className="font-mono text-[11.5px] leading-[1.5] break-all">
                  {hash}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="gray" onClick={copy}>
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    Sıfırla
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
