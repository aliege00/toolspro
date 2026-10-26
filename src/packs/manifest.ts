import manifestJson from "./manifest.json";
import type { PackManifest } from "./types";

export const packManifest = manifestJson as unknown as PackManifest;
export const catalogPacks = packManifest.packs;
