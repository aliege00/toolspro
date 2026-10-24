declare module "gifenc" {
  export type GifPalette = number[][];

  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array | Uint8ClampedArray,
      width: number,
      height: number,
      options?: { palette?: GifPalette; delay?: number; first?: boolean; transparent?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    reset(): void;
    bytesView(): Uint8Array;
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean },
  ): GifPalette[];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;
}
