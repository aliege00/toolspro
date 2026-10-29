import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Button,
  Chip,
  EmptyState,
  NavBar,
  ProgressBar,
  Sheet,
} from "@/components/ui";
import PinPad from "@/components/PinPad";
import Thumb from "@/components/Thumb";
import {
  AlbumIcon,
  FileIcon,
  FolderIcon,
  HeartIcon,
  ImageIcon,
  InfoIcon,
  LockIcon,
  MusicIcon,
  Play,
  PlusIcon,
  SearchIcon,
  SortIcon,
  StorageIcon,
  TrashBinIcon,
  DuplicateIcon,
  XMark,
} from "@/components/Icons";
import { formatDate, formatBytes, pickFiles } from "@/lib/files";
import { useBackHandler } from "@/lib/back";
import type { Kind } from "@/lib/files";
import type { Entry } from "@/lib/library";
import { useLibrary } from "@/lib/library";
import { useNav } from "@/lib/nav";
import { useI18n, useT } from "@/i18n";
import { sha256Hex } from "@/lib/media";
import { hasPin, verifyPin } from "@/lib/security";
import { displayName } from "@/lib/rename";
import { useAudioActions } from "@/lib/audio";

type Mode = "library" | "favorites" | "albums" | "hidden" | "trash";
type Filter = "all" | Kind;
type SortKey = "date" | "name" | "size";

const filters: { value: Filter; key: string }[] = [
  { value: "all", key: "filter.all" },
  { value: "video", key: "filter.video" },
  { value: "image", key: "filter.image" },
  { value: "audio", key: "filter.audio" },
  { value: "other", key: "filter.other" },
];

const modes: { value: Mode; key: string }[] = [
  { value: "library", key: "mode.library" },
  { value: "favorites", key: "mode.favorites" },
  { value: "albums", key: "mode.albums" },
  { value: "hidden", key: "mode.hidden" },
  { value: "trash", key: "mode.trash" },
];

const kindLabels: Record<Kind, string> = {
  video: "kind.video",
  image: "kind.image",
  audio: "kind.audio",
  other: "kind.other",
};

export default function FilesScreen() {
  const t = useT();
  const { lang } = useI18n();
  const { pop, push } = useNav();
  const { playQueue, openPlayer } = useAudioActions();
  const {
    entries,
    trashed,
    trashRecords,
    addFiles,
    trash,
    restore,
    purgeTrash,
    favorites,
    toggleFavorite,
    hidden,
    toggleHidden,
    albums,
    createAlbum,
    addToAlbum,
    deleteAlbum,
    hydrating,
    storageError,
    dismissStorageError,
  } = useLibrary();

  const [mode, setMode] = useState<Mode>("library");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);

  const [albumOpen, setAlbumOpen] = useState<string | null>(null);
  const [newAlbum, setNewAlbum] = useState(false);
  const [albumName, setAlbumName] = useState("");

  const [unlocked, setUnlocked] = useState(false);
  const [pinPrompt, setPinPrompt] = useState(false);
  const [wrongPin, setWrongPin] = useState(false);

  const [lightbox, setLightbox] = useState<Entry | null>(null);
  const [info, setInfo] = useState<Entry | null>(null);
  const [actions, setActions] = useState<Entry | null>(null);

  const [dupSheet, setDupSheet] = useState(false);
  const [storageSheet, setStorageSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pressTimer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  const pinExists = hasPin();

  // Android geri tuşu: tam ekran görsel açıkken önce görsel kapanır.
  useBackHandler(!!lightbox, () => {
    setLightbox(null);
    return true;
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1900);
  };

  const enterMode = (next: Mode) => {
    setAlbumOpen(null);
    if (next === "hidden" && pinExists && !unlocked) {
      setWrongPin(false);
      setPinPrompt(true);
      return;
    }
    setMode(next);
  };

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: 0, video: 0, image: 0, audio: 0, other: 0 };
    for (const e of entries) {
      if (hidden.includes(e.key)) continue;
      base.all += 1;
      base[e.kind] += 1;
    }
    return base;
  }, [entries, hidden]);

  const modeEntries = useMemo(() => {
    // PIN yoksa gizli dosyalar hiçbir koşulda listelenmez.
    if (mode === "hidden") {
      if (!pinExists) return [];
      return entries.filter((e) => hidden.includes(e.key));
    }
    const visible = entries.filter((e) => !hidden.includes(e.key));
    if (mode === "favorites") return visible.filter((e) => favorites.includes(e.key));
    return visible;
  }, [mode, entries, hidden, favorites, pinExists]);

  const albumEntries = useMemo(() => {
    const album = albums.find((a) => a.id === albumOpen);
    if (!album) return [];
    const byKey = new Map(entries.map((e) => [e.key, e]));
    return album.keys
      .map((k) => byKey.get(k))
      .filter((e): e is Entry => !!e && !hidden.includes(e.key));
  }, [albumOpen, albums, entries, hidden]);

  const visible = useMemo(() => {
    const source = albumOpen ? albumEntries : modeEntries;
    const query = search.trim().toLocaleLowerCase(lang);
    const filtered = source.filter((e) => {
      if (!albumOpen && filter !== "all" && e.kind !== filter) return false;
      if (query && !e.name.toLocaleLowerCase(lang).includes(query)) return false;
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sort === "name") cmp = a.name.localeCompare(b.name, lang);
      else if (sort === "size") cmp = a.size - b.size;
      else cmp = a.addedAt - b.addedAt;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [albumOpen, albumEntries, modeEntries, search, filter, sort, sortAsc, lang]);

  const totalSize = useMemo(
    () => visible.reduce((sum, e) => sum + e.size, 0),
    [visible],
  );

  const storageGroups = useMemo(() => {
    const map = new Map<string, { size: number; count: number }>();
    for (const e of entries) {
      const key = e.folder || "/";
      const current = map.get(key) ?? { size: 0, count: 0 };
      current.size += e.size;
      current.count += 1;
      map.set(key, current);
    }
    return [...map.entries()].sort((a, b) => b[1].size - a[1].size);
  }, [entries]);

  const storageTotal = useMemo(
    () => entries.reduce((sum, e) => sum + e.size, 0),
    [entries],
  );

  const addFromPicker = async (directory: boolean) => {
    const files = await pickFiles({ multiple: true, directory });
    if (files.length > 0) addFiles(files);
  };

  const open = (entry: Entry) => {
    if (entry.kind === "image") setLightbox(entry);
    else if (entry.kind === "audio") {
      // Kuyruk normalde gizli olmayan sesleri kapsar; açılan dosya gizli
      // klasördeyse o dosya da kuyruğa eklenir, aksi halde yanlış parça oynar.
      const tracks = entries
        .filter(
          (item) =>
            item.kind === "audio" &&
            (item.key === entry.key || !hidden.includes(item.key)),
        )
        .map((item) => ({
          id: item.id,
          title: item.name,
          subtitle: t("audio.backgroundNote"),
          url: item.url,
        }));
      playQueue(tracks, entry.id);
      openPlayer();
    } else if (entry.kind === "video") push({ name: "video", fileId: entry.id });
    else setInfo(entry);
  };

  const startPress = (entry: Entry) => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setActions(entry);
    }, 480);
  };

  const cancelPress = () => window.clearTimeout(pressTimer.current);

  const handleCellClick = (entry: Entry) => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    open(entry);
  };

  const createAlbumNow = () => {
    const name = albumName.trim();
    if (!name) return;
    createAlbum(name, []);
    setAlbumName("");
    setNewAlbum(false);
    showToast(t("files.albumCreate"));
  };

  const pickForAlbum = async (albumId: string) => {
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    const fresh = addFiles(files);
    addToAlbum(albumId, fresh.map((f) => f.key));
  };

  const renderGrid = (list: Entry[]) => (
    <div className="mt-3 grid grid-cols-3 gap-[6px]">
      {list.map((entry, i) => (
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
          onPointerDown={() => startPress(entry)}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onClick={() => handleCellClick(entry)}
          className="relative aspect-square overflow-hidden rounded-[12px] bg-fill"
        >
          {entry.kind === "image" ? (
            <motion.div layoutId={`cell-${entry.id}`} className="h-full w-full">
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
            <div className="flex h-full w-full items-center justify-center bg-tile text-tile-ink">
              <MusicIcon size={30} />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink2">
              <FileIcon size={26} />
              <span className="px-1 text-[10px] font-medium break-all">
                {entry.name.split(".").pop()?.slice(0, 8) ?? "—"}
              </span>
            </div>
          )}

          {entry.kind === "video" && (
            <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
              <Play size={12} />
            </span>
          )}
          {favorites.includes(entry.key) && (
            <span className="absolute top-1.5 right-1.5 text-white drop-shadow">
              <HeartIcon size={15} strokeWidth={2.2} />
            </span>
          )}
          {hidden.includes(entry.key) && mode === "hidden" && (
            <span className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white">
              <LockIcon size={12} />
            </span>
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-left text-[9.5px] text-white/90">
            {displayName(entry.key, entry.name)}
          </span>
        </motion.button>
      ))}
    </div>
  );

  const showKindChips = !albumOpen && mode !== "trash" && mode !== "albums";

  return (
    <div className="safe-bottom min-h-full pb-10">
      <NavBar
        title={t("files.title")}
        subtitle={entries.length > 0 ? t("files.items", { n: entries.length }) : undefined}
        onBack={pop}
        right={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDupSheet(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 active:bg-fill"
              aria-label={t("files.dupTitle")}
            >
              <DuplicateIcon size={19} />
            </button>
            <button
              type="button"
              onClick={() => setStorageSheet(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 active:bg-fill"
              aria-label={t("files.storageTitle")}
            >
              <StorageIcon size={19} />
            </button>
          </div>
        }
      />

      <div className="px-4 pt-4">
        {!albumOpen && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {modes.map((m) => (
              <Chip
                key={m.value}
                active={mode === m.value}
                onClick={() => enterMode(m.value)}
              >
                {t(m.key)}
              </Chip>
            ))}
          </div>
        )}

        {albumOpen && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex items-center gap-1 text-[14px] font-medium text-tint"
              onClick={() => setAlbumOpen(null)}
            >
              ‹ {t("mode.albums")}
            </button>
            <span className="truncate text-[15px] font-semibold">
              {albums.find((a) => a.id === albumOpen)?.name}
            </span>
            <button
              type="button"
              className="text-[14px] font-medium text-tint"
              onClick={() => void pickForAlbum(albumOpen)}
            >
              {t("files.albumAdd")}
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-danger active:bg-fill"
              aria-label={t("files.albumDelete")}
              onClick={() => {
                deleteAlbum(albumOpen);
                setAlbumOpen(null);
              }}
            >
              <TrashBinIcon size={17} />
            </button>
          </div>
        )}

        {mode !== "trash" && (
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink3">
                <SearchIcon size={17} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("files.search")}
                className="h-10 w-full rounded-[12px] bg-fill pr-9 pl-9 text-[15px] outline-none placeholder:text-ink3"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink3"
                  aria-label={t("common.close")}
                >
                  <XMark size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSortSheet(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-fill text-ink2 active:bg-card"
              aria-label={t("files.sortTitle")}
            >
              <SortIcon size={18} />
            </button>
          </div>
        )}

        {showKindChips && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {filters.map((f) => (
              <Chip
                key={f.value}
                active={filter === f.value}
                count={counts[f.value]}
                onClick={() => setFilter(f.value)}
              >
                {t(f.key)}
              </Chip>
            ))}
          </div>
        )}

        {storageError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-start gap-3 rounded-[12px] bg-fill px-3.5 py-3"
          >
            <p className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-ink2">
              {t("files.storageError", { message: storageError })}
            </p>
            <button
              type="button"
              onClick={dismissStorageError}
              className="shrink-0 text-[12.5px] font-medium text-tint"
            >
              {t("files.storageErrorDismiss")}
            </button>
          </motion.div>
        )}

        {/* ---------- Trash mode ---------- */}
        {mode === "trash" && !albumOpen ? (
          <div className="mt-4">
            {trashed.length === 0 && trashRecords.length === 0 ? (
              <EmptyState
                icon={<TrashBinIcon size={30} />}
                title={t("files.trashEmpty")}
                description={t("files.trashNote")}
              />
            ) : (
              <>
                <p className="mb-3 text-[12.5px] leading-[1.45] text-ink2">
                  {t("files.trashNote")}
                </p>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {trashed.map((entry) => (
                      <motion.div
                        key={`s-${entry.key}`}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        className="flex items-center gap-3 rounded-[14px] bg-card p-2.5 shadow-[var(--shadow-card)]"
                      >
                        <div className="h-11 w-16 shrink-0 overflow-hidden rounded-[8px]">
                          {entry.kind === "video" ? (
                            <Thumb entry={entry} />
                          ) : entry.kind === "image" ? (
                            <img src={entry.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-fill text-ink3">
                              <FileIcon size={18} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{entry.name}</p>
                          <p className="text-[12px] text-ink2">{formatBytes(entry.size)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (restore(entry.key)) showToast(t("files.restored"));
                          }}
                        >
                          {t("files.trashRestore")}
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {trashRecords
                    .filter((r) => !trashed.some((e) => e.key === r.key))
                    .map((record) => (
                      <div
                        key={`r-${record.key}`}
                        className="flex items-center gap-3 rounded-[14px] bg-fill p-3 opacity-75"
                      >
                        <FileIcon size={20} className="shrink-0 text-ink3" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{record.name}</p>
                          <p className="text-[12px] text-ink2">
                            {formatBytes(record.size)} · {formatDate(record.deletedAt)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11.5px] text-ink3">
                          {t("files.trashGone")}
                        </span>
                      </div>
                    ))}
                </div>

                <div className="mt-5">
                  <Button full variant="gray" size="md" onClick={purgeTrash}>
                    {t("files.trashPurge")}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : mode === "albums" && !albumOpen ? (
          /* ---------- Albums ---------- */
          <div className="mt-4">
            {albums.length === 0 ? (
              <EmptyState
                icon={<AlbumIcon size={30} />}
                title={t("files.albumsEmpty")}
                description={t("files.albumAdd")}
              >
                <Button full onClick={() => setNewAlbum(true)}>
                  <PlusIcon size={18} />
                  {t("files.albumNew")}
                </Button>
              </EmptyState>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {albums.map((album, i) => {
                    const cover = album.keys
                      .map((k) => entries.find((e) => e.key === k))
                      .find((e) => e?.kind === "image");
                    return (
                      <motion.button
                        key={album.id}
                        type="button"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.35 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setAlbumOpen(album.id)}
                        className="overflow-hidden rounded-[16px] bg-card text-left shadow-[var(--shadow-card)]"
                      >
                        <div className="aspect-[4/3] w-full bg-fill">
                          {cover ? (
                            <img
                              src={cover.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-ink3">
                              <AlbumIcon size={30} />
                            </div>
                          )}
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="truncate text-[14.5px] font-semibold">{album.name}</p>
                          <p className="text-[12px] text-ink2">
                            {t("files.items", { n: album.keys.length })}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <Button full variant="secondary" onClick={() => setNewAlbum(true)}>
                    <PlusIcon size={18} />
                    {t("files.albumNew")}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : hydrating && entries.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink3 border-t-transparent" />
            <p className="mt-4 text-[14px] text-ink2">{t("files.loading")}</p>
          </div>
        ) : visible.length === 0 ? (
          /* ---------- Empty states ---------- */
          mode === "favorites" ? (
            <EmptyState
              icon={<HeartIcon size={30} />}
              title={t("files.favEmpty")}
              description={t("files.moveToTrashHint")}
            >
              <Button full variant="gray" onClick={() => enterMode("library")}>
                {t("mode.library")}
              </Button>
            </EmptyState>
          ) : mode === "hidden" ? (
            pinExists ? (
              <EmptyState
                icon={<LockIcon size={30} />}
                title={t("files.hiddenEmpty")}
                description={t("files.moveToTrashHint")}
              />
            ) : (
              <EmptyState
                icon={<LockIcon size={30} />}
                title={t("files.pinNeeded")}
                description={t("files.pinSettings")}
              >
                <Button full onClick={() => push({ name: "settings" })}>
                  {t("settings.title")}
                </Button>
              </EmptyState>
            )
          ) : (
            <EmptyState
              icon={<FolderIcon size={30} />}
              title={entries.length === 0 ? t("files.emptyTitle") : t("files.search")}
              description={entries.length === 0 ? t("files.emptyDesc") : undefined}
            >
              {entries.length === 0 && (
                <div className="space-y-2">
                  <Button full onClick={() => void addFromPicker(true)}>
                    {t("files.folder")}
                  </Button>
                  <Button full variant="gray" onClick={() => void addFromPicker(false)}>
                    {t("files.add")}
                  </Button>
                </div>
              )}
            </EmptyState>
          )
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between text-[12.5px] text-ink2">
              <span>{t("files.summary", { n: visible.length, size: formatBytes(totalSize) })}</span>
              <span className="text-ink3">{t("files.moveToTrashHint")}</span>
            </div>
            {renderGrid(visible)}
          </>
        )}

        {entries.length > 0 && mode === "library" && !albumOpen && (
          <div className="mt-6 flex gap-2.5">
            <Button size="md" variant="secondary" className="flex-1" onClick={() => void addFromPicker(true)}>
              <FolderIcon size={18} />
              {t("files.folder")}
            </Button>
            <Button size="md" variant="gray" className="flex-1" onClick={() => void addFromPicker(false)}>
              <ImageIcon size={18} />
              {t("files.add")}
            </Button>
          </div>
        )}
      </div>

      {/* ---------- Lightbox ---------- */}
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
                <p className="truncate text-[14px] font-medium text-white">{lightbox.name}</p>
                <p className="text-[12px] text-white/60">{formatBytes(lightbox.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25"
                aria-label={t("common.close")}
              >
                <XMark size={20} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ---------- Actions (long-press) ---------- */}
      <Sheet
        open={!!actions}
        onClose={() => setActions(null)}
        title={t("files.actions")}
      >
        {actions && (
          <div className="space-y-2">
            <p className="mb-3 truncate text-[14px] text-ink2">{actions.name}</p>
            <ActionRow
              icon={<HeartIcon size={19} />}
              label={
                favorites.includes(actions.key)
                  ? t("files.favoriteRemove")
                  : t("files.favoriteAdd")
              }
              onClick={() => {
                toggleFavorite(actions.key);
                setActions(null);
              }}
            />
            <ActionRow
              icon={<LockIcon size={19} />}
              label={
                hidden.includes(actions.key) ? t("files.unhide") : t("files.hide")
              }
              onClick={() => {
                toggleHidden(actions.key);
                setActions(null);
              }}
            />
            <ActionRow
              icon={<InfoIcon size={19} />}
              label={t("files.infoTitle")}
              onClick={() => {
                setInfo(actions);
                setActions(null);
              }}
            />
            <ActionRow
              icon={<TrashBinIcon size={19} />}
              label={t("files.delete")}
              danger
              onClick={() => {
                trash(actions.id);
                setActions(null);
                showToast(t("files.delete"));
              }}
            />
          </div>
        )}
      </Sheet>

      {/* ---------- Sort ---------- */}
      <Sheet open={sortSheet} onClose={() => setSortSheet(false)} title={t("files.sortTitle")}>
        <div className="space-y-1">
          {(["date", "name", "size"] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className="flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left text-[15.5px] active:bg-fill"
            >
              <span>{t(`sort.${key}`)}</span>
              {sort === key && <span className="text-tint">✓</span>}
            </button>
          ))}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant={sortAsc ? "primary" : "gray"}
              className="flex-1"
              onClick={() => setSortAsc(true)}
            >
              {t("sort.asc")}
            </Button>
            <Button
              size="sm"
              variant={!sortAsc ? "primary" : "gray"}
              className="flex-1"
              onClick={() => setSortAsc(false)}
            >
              {t("sort.desc")}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* ---------- New album ---------- */}
      <Sheet open={newAlbum} onClose={() => setNewAlbum(false)} title={t("files.albumNew")}>
        <div className="space-y-3">
          <input
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
            placeholder={t("files.albumName")}
            className="h-12 w-full rounded-[13px] bg-fill px-4 text-[16px] outline-none placeholder:text-ink3"
          />
          <Button full onClick={createAlbumNow} disabled={!albumName.trim()}>
            {t("files.albumCreate")}
          </Button>
        </div>
      </Sheet>

      {/* ---------- PIN gate ---------- */}
      <AnimatePresence>
        {pinPrompt && (
          <PinPad
            title={t("files.pinNeeded")}
            wrong={wrongPin}
            onCancel={() => setPinPrompt(false)}
            onComplete={(pin) => {
              void verifyPin(pin).then((ok) => {
                if (ok) {
                  setUnlocked(true);
                  setWrongPin(false);
                  setPinPrompt(false);
                  setMode("hidden");
                } else {
                  setWrongPin(true);
                }
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* ---------- Duplicates ---------- */}
      <DuplicatesSheet
        open={dupSheet}
        onClose={() => setDupSheet(false)}
        targets={entries.filter((e) => !hidden.includes(e.key))}
      />

      {/* ---------- Storage ---------- */}
      <Sheet
        open={storageSheet}
        onClose={() => setStorageSheet(false)}
        title={t("files.storageTitle")}
      >
        {storageGroups.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-ink2">
            {t("files.storageEmpty")}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-ink2">{t("files.storageNote")}</p>
            {storageGroups.map(([folder, data]) => {
              const pct = storageTotal > 0 ? (data.size / storageTotal) * 100 : 0;
              const max = storageGroups[0][1].size || 1;
              return (
                <div key={folder}>
                  <div className="mb-1 flex items-center justify-between text-[13.5px]">
                    <span className="truncate pr-2">{folder === "/" ? "—" : folder}</span>
                    <span className="shrink-0 text-ink2">
                      {formatBytes(data.size)} · %{Math.round(pct)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-fill">
                    <motion.div
                      className="h-full rounded-full bg-tint"
                      initial={{ width: 0 }}
                      animate={{ width: `${(data.size / max) * 100}%` }}
                      transition={{ type: "spring", stiffness: 140, damping: 24 }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-ink3">
                    {t("files.items", { n: data.count })}
                  </p>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-line pt-3 text-[14px] font-semibold">
              <span>{t("files.storageTotal")}</span>
              <span>{formatBytes(storageTotal)}</span>
            </div>
          </div>
        )}
      </Sheet>

      <FileSheet entry={info} onClose={() => setInfo(null)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-0 bottom-10 z-[70] flex justify-center"
          >
            <span className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg shadow-lg">
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[13px] bg-fill px-4 py-3.5 text-left text-[15.5px] active:opacity-70 ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      <span className={danger ? "text-danger" : "text-ink2"}>{icon}</span>
      {label}
    </button>
  );
}

function DuplicatesSheet({
  open,
  onClose,
  targets,
}: {
  open: boolean;
  onClose: () => void;
  targets: Entry[];
}) {
  const t = useT();
  const { trash } = useLibrary();
  const [state, setState] = useState<"idle" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [scanned, setScanned] = useState(0);
  const [groups, setGroups] = useState<{ hash: string; entries: Entry[] }[]>([]);
  const cancelRef = useRef(false);

  const scan = async () => {
    cancelRef.current = false;
    setState("scanning");
    setProgress(0);
    setGroups([]);
    const map = new Map<string, Entry[]>();
    let done = 0;
    for (const entry of targets) {
      if (cancelRef.current) break;
      try {
        const hash = await sha256Hex(entry.file, () => undefined);
        const list = map.get(hash);
        if (list) list.push(entry);
        else map.set(hash, [entry]);
      } catch {
        /* okunamayan dosya atlanır */
      }
      done += 1;
      setScanned(done);
      setProgress(done / Math.max(1, targets.length));
    }
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const result = [...map.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([hash, list]) => ({ hash, entries: list }));
    setGroups(result);
    setState("done");
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("files.dupTitle")}>
      <div className="space-y-4">
        <p className="text-[12.5px] leading-[1.45] text-ink2">{t("files.dupNote")}</p>

        {state !== "scanning" && (
          <Button full onClick={() => void scan()} disabled={targets.length < 2}>
            {t("files.dupScan")}
          </Button>
        )}

        {state === "scanning" && (
          <div className="space-y-2">
            <ProgressBar ratio={progress} />
            <div className="flex items-center justify-between text-[12.5px] text-ink2">
              <span>{t("files.dupScanning", { p: Math.round(progress * 100) })}</span>
              <button
                type="button"
                className="font-medium text-danger"
                onClick={() => {
                  cancelRef.current = true;
                  setState("idle");
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {state === "done" && (
          <>
            <p className="text-[13px] text-ink2">
              {t("files.dupScanned", { n: scanned })}
            </p>
            {groups.length === 0 ? (
              <p className="rounded-[12px] bg-fill px-4 py-4 text-center text-[14px] text-ink2">
                {t("files.dupNone")}
              </p>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <motion.div
                    key={group.hash}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[14px] bg-fill p-3"
                  >
                    <p className="mb-2 text-[12.5px] font-semibold text-ink2">
                      {t("files.dupGroup", { n: group.entries.length })} ·{" "}
                      {formatBytes(group.entries.reduce((s, e) => s + e.size, 0))}
                    </p>
                    <div className="space-y-2">
                      {group.entries.map((entry) => (
                        <div
                          key={entry.key}
                          className="flex items-center gap-2 rounded-[10px] bg-card px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13.5px]">
                            {entry.name}
                          </span>
                          <span className="shrink-0 text-[12px] text-ink2">
                            {formatBytes(entry.size)}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-[12.5px] font-medium text-danger"
                            onClick={() => {
                              trash(entry.id);
                              setGroups((prev) =>
                                prev
                                  .map((g) => ({
                                    ...g,
                                    entries: g.entries.filter((x) => x.key !== entry.key),
                                  }))
                                  .filter((g) => g.entries.length > 1),
                              );
                            }}
                          >
                            {t("files.delete")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function FileSheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const t = useT();
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
      setError(e instanceof Error ? e.message : "—");
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
      title={t("files.infoTitle")}
    >
      {entry && (
        <div>
          <p className="mb-4 text-[15px] break-all">{displayName(entry.key, entry.name)}</p>
          <div className="overflow-hidden rounded-[14px]">
            {[
              [t("info.type"), t(kindLabels[entry.kind])],
              [t("info.size"), formatBytes(entry.size)],
              [t("info.contentType"), entry.file.type || "—"],
              [t("info.modified"), formatDate(entry.file.lastModified)],
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
              <Button full variant="secondary" loading={busy} onClick={() => void compute()}>
                {t("files.hashCta")}
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
                <p className="font-mono text-[11.5px] leading-[1.5] break-all">{hash}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="gray" onClick={() => void copy()}>
                    {copied ? t("common.copied") : t("common.copy")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    {t("common.clear")}
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
