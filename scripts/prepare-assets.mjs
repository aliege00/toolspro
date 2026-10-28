import { cpSync, existsSync, mkdirSync, statSync, createWriteStream, readFileSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { gunzipSync } from "node:zlib";
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

const fontDir = join(publicDir, "fonts");
const FONTS = [
  {
    name: "DejaVuSans.ttf",
    url: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf",
  },
  {
    name: "DejaVuSans-Bold.ttf",
    url: "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf",
  },
];

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

/**
 * Android aapt paketlerken `.gz` dosyalarını açıp uzantısını atar;
 * bu yüzden dil paketlerini açılmış hâlde (`.traineddata`) tutuyoruz
 * ve OCR'da `gzip: false` kullanıyoruz.
 */
async function ensureLang(code, url) {
  const plain = join(langDir, `${code}.traineddata`);
  const gz = `${plain}.gz`;
  if (existsSync(plain) && statSync(plain).size > 0) {
    if (existsSync(gz)) unlinkSync(gz);
    return;
  }
  if (!existsSync(gz)) {
    await download(url, gz);
  }
  const raw = readFileSync(gz);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(plain, gunzipSync(raw));
  unlinkSync(gz);
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
    try {
      await ensureLang(lang.code, lang.url);
      console.log(`[assets] ${lang.code} dil paketi hazır`);
    } catch (error) {
      console.warn(
        `[assets] ${lang.code} indirilemedi (${error.message}) — OCR bu dilde çevrimdışı çalışmayabilir`,
      );
    }
  }

  // --- PDF yazı tipleri (PPTX/TXT → PDF; DejaVu, Bitstream Vera licence) ---
  ensure(fontDir);
  for (const font of FONTS) {
    const dest = join(fontDir, font.name);
    try {
      if (!existsSync(dest) || statSync(dest).size === 0) {
        await download(font.url, dest);
      }
      console.log(`[assets] ${font.name} hazır`);
    } catch (error) {
      console.warn(
        `[assets] ${font.name} indirilemedi (${error.message}) — PDF metinleri yedek yazı tipiyle çizilir`,
      );
    }
  }
}

main().catch((error) => {
  console.error("[assets] hazırlık hatası:", error);
  process.exit(1);
});
