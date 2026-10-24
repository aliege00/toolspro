import { cpSync, existsSync, mkdirSync, statSync, createWriteStream } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const publicDir = join(root, "public");

function ensure(dir) {
  mkdirSync(dir, { recursive: true });
}

function copyFile(src, destDir) {
  if (!existsSync(src)) return false;
  ensure(destDir);
  const dest = join(destDir, basename(src));
  const srcSize = statSync(src).size;
  if (existsSync(dest) && statSync(dest).size === srcSize) return true;
  cpSync(src, dest);
  return true;
}

const langDir = join(publicDir, "ocr", "lang");
const LANGS = [
  {
    code: "eng",
    url: "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_fast/eng.traineddata.gz",
  },
  {
    code: "tur",
    url: "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_fast/tur.traineddata.gz",
  },
];

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

async function main() {
  // --- FFmpeg.wasm çekirdeği (zorunlu) ---
  const ffmpegSrc = join(nm, "@ffmpeg", "core", "dist", "esm");
  const ffmpegOk = [
    copyFile(join(ffmpegSrc, "ffmpeg-core.js"), join(publicDir, "ffmpeg")),
    copyFile(join(ffmpegSrc, "ffmpeg-core.wasm"), join(publicDir, "ffmpeg")),
  ].every(Boolean);
  if (!ffmpegOk) {
    console.error(
      "[assets] @ffmpeg/core bulunamadı — önce `bun install` çalıştırın.",
    );
    process.exit(1);
  }
  console.log("[assets] ffmpeg çekirdeği hazır");

  // --- Tesseract worker + core varyantları (zorunlu) ---
  const workerOk = copyFile(
    join(nm, "tesseract.js", "dist", "worker.min.js"),
    join(publicDir, "ocr"),
  );
  const coreSrc = join(nm, "tesseract.js-core");
  const coreFiles = existsSync(coreSrc)
    ? [
        "tesseract-core-lstm.wasm.js",
        "tesseract-core-simd-lstm.wasm.js",
        "tesseract-core-relaxedsimd-lstm.wasm.js",
      ]
    : [];
  const coreOk = coreFiles.every((file) =>
    copyFile(join(coreSrc, file), join(publicDir, "ocr", "core")),
  );
  if (!workerOk || !coreOk) {
    console.error(
      "[assets] tesseract.js varlıkları bulunamadı — önce `bun install` çalıştırın.",
    );
    process.exit(1);
  }
  console.log("[assets] tesseract çekirdeği hazır");

  // --- Dil paketleri (TR/EN çevrimdışı; indirilemezse uyarı) ---
  ensure(langDir);
  for (const lang of LANGS) {
    const dest = join(langDir, `${lang.code}.traineddata.gz`);
    if (existsSync(dest) && statSync(dest).size > 0) continue;
    try {
      await download(lang.url, dest);
      console.log(`[assets] ${lang.code} dil paketi indirildi`);
    } catch (error) {
      console.warn(
        `[assets] ${lang.code} indirilemedi (${error.message}) — OCR bu dilde çevrimdışı çalışmayabilir`,
      );
    }
  }
}

main().catch((error) => {
  console.error("[assets] hazırlık hatası:", error);
  process.exit(1);
});
