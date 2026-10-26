export type PackKind = "transitions" | "filters" | "fonts" | "stickers" | "music";

export type LocalizedText = { tr: string; en: string };

export type CatalogPack = {
  id: string;
  kind: PackKind;
  title: LocalizedText;
  description: LocalizedText;
  version: number;
  file: string;
  size: number;
  sha256: string;
  license: string;
  source: string;
};

export type PackManifest = {
  manifestVersion: number;
  releasedAt: string;
  baseUrl: string;
  packs: CatalogPack[];
};

export type PackItem = {
  id: string;
  label?: string;
  title?: LocalizedText;
  file?: string;
  license?: string;
  source?: string;
  artist?: string;
  duration?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
};

export type PackContent = {
  id: string;
  kind: PackKind;
  version: number;
  title: LocalizedText;
  license: string;
  source: string;
  artist?: string;
  items: PackItem[];
};

export type InstalledPack = PackContent & {
  installedAt: number;
  /** Cihazdaki paket klasörü (Filesystem.Data göreli). */
  dir: string;
};

export type PackFilterItem = {
  packId: string;
  id: string;
  label: string;
  brightness: number;
  contrast: number;
  saturation: number;
};

export type PackTransitionItem = {
  packId: string;
  id: "blur" | "flash";
  label: string;
};

export type PackFontItem = {
  packId: string;
  id: string;
  label: string;
  fontId: string;
};

export type PackMusicItem = {
  packId: string;
  id: string;
  title: string;
  file: string;
  duration: number;
  artist: string;
};

export type PackStickerItem = {
  packId: string;
  id: string;
  label: string;
  file: string;
};

export type PackProgress = {
  packId: string;
  received: number;
  total: number;
};

export type PackErrorCode =
  | "network"
  | "browser"
  | "hash"
  | "cancelled"
  | "storage"
  | "invalid"
  | "server";

export class PackError extends Error {
  code: PackErrorCode;

  constructor(code: PackErrorCode, message: string) {
    super(message);
    this.name = "PackError";
    this.code = code;
  }
}
