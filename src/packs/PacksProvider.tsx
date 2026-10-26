import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { catalogPacks } from "./manifest";
import {
  installPack,
  isPackCancelled,
  listInstalledPacks,
  packFontId,
  registerPackFont,
  removePack,
  revokePackAssets,
  unregisterPackFonts,
} from "./install";
import type {
  CatalogPack,
  InstalledPack,
  LocalizedText,
  PackErrorCode,
  PackFilterItem,
  PackFontItem,
  PackMusicItem,
  PackStickerItem,
  PackTransitionItem,
} from "./types";
import { PackError } from "./types";

type ActiveDownload = {
  packId: string;
  received: number;
  total: number;
};

type PacksCtx = {
  ready: boolean;
  available: CatalogPack[];
  packs: InstalledPack[];
  active: ActiveDownload | null;
  error: PackErrorCode | null;
  install: (pack: CatalogPack) => Promise<boolean>;
  remove: (packId: string) => Promise<void>;
  cancel: () => void;
  clearError: () => void;
  transitions: PackTransitionItem[];
  filters: PackFilterItem[];
  fonts: PackFontItem[];
  music: PackMusicItem[];
  stickers: PackStickerItem[];
};

const Ctx = createContext<PacksCtx | null>(null);

function localized(text: LocalizedText | undefined, lang: "tr" | "en"): string {
  return text ? text[lang] : "";
}

export function PacksProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [packs, setPacks] = useState<InstalledPack[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<ActiveDownload | null>(null);
  const [error, setError] = useState<PackErrorCode | null>(null);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listInstalledPacks();
      for (const pack of list) {
        if (pack.kind !== "fonts") continue;
        for (const item of pack.items) {
          try {
            await registerPackFont(pack.id, item);
          } catch {
            // Bozuk font paketi diğer paketleri engellemez.
          }
        }
      }
      setPacks(list);
    } catch {
      setPacks([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const install = useCallback(
    async (pack: CatalogPack): Promise<boolean> => {
      if (controller.current) return false;
      setError(null);
      const abort = new AbortController();
      controller.current = abort;
      setActive({ packId: pack.id, received: 0, total: pack.size });
      try {
        await installPack(pack, {
          signal: abort.signal,
          onProgress: (received, total) => {
            setActive({ packId: pack.id, received, total: total || pack.size });
          },
        });
        await load();
        return true;
      } catch (failure) {
        if (!isPackCancelled(failure)) {
          setError(failure instanceof PackError ? failure.code : "storage");
        }
        return false;
      } finally {
        controller.current = null;
        setActive(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (packId: string) => {
      revokePackAssets(packId);
      unregisterPackFonts(packId);
      await removePack(packId);
      await load();
    },
    [load],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const transitions = useMemo<PackTransitionItem[]>(
    () =>
      packs
        .filter((pack) => pack.kind === "transitions")
        .flatMap((pack) =>
          pack.items
            .filter((item) => item.id === "blur" || item.id === "flash")
            .map((item) => ({
              packId: pack.id,
              id: item.id as "blur" | "flash",
              label: localized(item.title, lang),
            })),
        ),
    [packs, lang],
  );

  const filters = useMemo<PackFilterItem[]>(
    () =>
      packs
        .filter((pack) => pack.kind === "filters")
        .flatMap((pack) =>
          pack.items.map((item) => ({
            packId: pack.id,
            id: item.id,
            label: localized(item.title, lang),
            brightness: item.brightness ?? 0,
            contrast: item.contrast ?? 0,
            saturation: item.saturation ?? 0,
          })),
        ),
    [packs, lang],
  );

  const fonts = useMemo<PackFontItem[]>(
    () =>
      packs
        .filter((pack) => pack.kind === "fonts")
        .flatMap((pack) =>
          pack.items
            .filter((item) => !!item.file)
            .map((item) => ({
              packId: pack.id,
              id: item.id,
              label: item.label ?? item.id,
              fontId: packFontId(pack.id, item.id),
            })),
        ),
    [packs],
  );

  const music = useMemo<PackMusicItem[]>(
    () =>
      packs
        .filter((pack) => pack.kind === "music")
        .flatMap((pack) =>
          pack.items
            .filter((item) => !!item.file)
            .map((item) => ({
              packId: pack.id,
              id: item.id,
              title: localized(item.title, lang),
              file: item.file!,
              duration: item.duration ?? 0,
              artist: item.artist ?? "",
            })),
        ),
    [packs, lang],
  );

  const stickers = useMemo<PackStickerItem[]>(
    () =>
      packs
        .filter((pack) => pack.kind === "stickers")
        .flatMap((pack) =>
          pack.items
            .filter((item) => !!item.file)
            .map((item) => ({
              packId: pack.id,
              id: item.id,
              label: item.label ?? item.id,
              file: item.file!,
            })),
        ),
    [packs],
  );

  const value = useMemo<PacksCtx>(
    () => ({
      ready,
      available: catalogPacks,
      packs,
      active,
      error,
      install,
      remove,
      cancel,
      clearError,
      transitions,
      filters,
      fonts,
      music,
      stickers,
    }),
    [
      ready,
      packs,
      active,
      error,
      install,
      remove,
      cancel,
      clearError,
      transitions,
      filters,
      fonts,
      music,
      stickers,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePacks() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePacks must be used within PacksProvider");
  return ctx;
}
