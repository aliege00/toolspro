import { deflateSync } from "node:zlib";
import {
  mkdirSync,
  writeFileSync,
  createWriteStream,
  existsSync,
  readFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { zipSync, strToU8 } from "fflate";

/**
 * BeyTool paket üreticisi.
 *
 * - Geçiş, filtre, font, çıkartma ve müzik paketlerini üretir.
 * - Her paket için SHA-256 ve boyut hesaplayıp manifest yazar.
 * - Çıktı: packs-dist/ (GitHub Releases'e yüklenir).
 *
 * Fontlar SIL Open Font License 1.1 altındadır; çıkartma ve müzikler
 * bu betikle sıfırdan üretildiği için CC0-1.0 sayılır.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "packs-dist");
const workDir = join(root, ".packs-build");
const REPO = "aliege00/toolspro";
const TAG = "packs-v1";
const BASE_URL = `https://github.com/${REPO}/releases/download/${TAG}`;
const SOURCE = `https://github.com/${REPO}/releases/tag/${TAG}`;

mkdirSync(outDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* PNG üretici (bağımlılıksız, RGBA)                                   */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Şekiller                                                            */
/* ------------------------------------------------------------------ */

function darken(hex, amount = 0.42) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((value >> 16) & 255) * (1 - amount));
  const g = Math.round(((value >> 8) & 255) * (1 - amount));
  const b = Math.round((value & 255) * (1 - amount));
  return [r, g, b];
}

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function starShape(x, y) {
  const cx = 128;
  const cy = 132;
  const dx = x - cx;
  const dy = cy - y;
  const angle = Math.atan2(dy, dx);
  const radius = Math.hypot(dx, dy);
  const point = Math.PI / 2 + Math.round((angle - Math.PI / 2) / (Math.PI / 5)) * (Math.PI / 5);
  const outer = 102;
  const inner = 45;
  const t = ((point - Math.PI / 2) / (Math.PI / 5)) % 2;
  const limit = Math.abs(t) < 1 ? inner + (outer - inner) * (1 - Math.abs(t)) : inner;
  return radius <= limit;
}

function circleShape(x, y) {
  return Math.hypot(x - 128, y - 128) <= 104;
}

function ringShape(x, y) {
  const distance = Math.hypot(x - 128, y - 128);
  return distance <= 104 && distance >= 66;
}

function heartShape(x, y) {
  const nx = (x - 128) / 104;
  const ny = -(y - 132) / 104;
  const base = nx * nx + ny * ny - 1;
  return base * base * base - nx * nx * ny * ny * ny <= 0;
}

function bubbleShape(x, y) {
  const inBox =
    x >= 34 && x <= 222 && y >= 42 && y <= 172;
  const radius = 30;
  let rounded = false;
  if (inBox) {
    const nearestX = Math.min(Math.max(x, 34 + radius), 222 - radius);
    const nearestY = Math.min(Math.max(y, 42 + radius), 172 - radius);
    rounded =
      (x >= 34 + radius && x <= 222 - radius) ||
      (y >= 42 + radius && y <= 172 - radius) ||
      Math.hypot(x - nearestX, y - nearestY) <= radius;
  }
  const tail =
    y >= 155 &&
    y <= 222 &&
    x >= 78 &&
    x <= 140 &&
    y <= 222 - (x - 78) * 0.95;
  return rounded || tail;
}

function triangleShape(x, y) {
  return x >= 84 && x <= 208 && y >= 56 && y <= 200 && (x - 84) / 124 >= Math.abs(y - 128) / 72;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function checkShape(x, y) {
  return (
    segmentDistance(x, y, 62, 132, 108, 178) <= 24 ||
    segmentDistance(x, y, 108, 178, 196, 82) <= 24
  );
}

const STICKERS = [
  { id: "star", color: "#b9a88d", shape: starShape },
  { id: "ring", color: "#8b93a1", shape: ringShape },
  { id: "heart", color: "#b08b7a", shape: heartShape },
  { id: "bubble", color: "#f4f1ea", shape: bubbleShape },
  { id: "play", color: "#93a095", shape: triangleShape },
  { id: "check", color: "#f4f1ea", shape: checkShape },
];

function renderSticker(shape, color) {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  const inner = rgb(color);
  const outer = darken(color);
  const samples = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let coverage = 0;
      let innerCoverage = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (shape(128 + (px - 128) * 1.045, 128 + (py - 128) * 1.045)) coverage += 1;
          if (shape(px, py)) innerCoverage += 1;
        }
      }
      const total = samples * samples;
      if (coverage === 0) continue;
      const alpha = Math.round((coverage / total) * 255);
      const filled = innerCoverage / total >= 0.5;
      const [r, g, b] = filled ? inner : outer;
      const index = (y * size + x) * 4;
      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = alpha;
    }
  }
  return encodePng(size, size, pixels);
}

/* ------------------------------------------------------------------ */
/* WAV üretici                                                         */
/* ------------------------------------------------------------------ */

const SAMPLE_RATE = 22050;
const DURATION = 16;

function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function renderMusic(kind) {
  const length = SAMPLE_RATE * DURATION;
  const mix = new Float32Array(length);

  const addTone = (note, start, duration, gain, harmonics, kindName) => {
    const from = Math.floor(start * SAMPLE_RATE);
    const to = Math.min(length, Math.floor((start + duration) * SAMPLE_RATE));
    const hz = midiToHz(note);
    for (let i = from; i < to; i += 1) {
      const t = (i - from) / SAMPLE_RATE;
      const local = t / duration;
      const attack = Math.min(1, t / (kindName === "pluck" ? 0.012 : 0.5));
      const release = Math.min(1, (duration - t) / (kindName === "pluck" ? 0.35 : 0.9));
      const envelope = Math.max(0, Math.min(attack, release));
      let value = 0;
      if (kindName === "pluck") {
        value =
          Math.sin(2 * Math.PI * hz * t) * 0.7 +
          Math.sin(2 * Math.PI * hz * 2 * t) * 0.2 +
          Math.sin(2 * Math.PI * hz * 3 * t) * 0.08;
        value *= Math.exp(-3.2 * local);
      } else {
        for (let h = 0; h < harmonics.length; h += 1) {
          const ratio = i / SAMPLE_RATE;
          value +=
            Math.sin(2 * Math.PI * hz * (h + 1) * t + 0.2 * Math.sin(0.4 * ratio)) *
            harmonics[h];
        }
      }
      mix[i] += value * envelope * gain;
    }
  };

  const chords =
    kind === 0
      ? [
          [48, 55, 59, 64],
          [45, 52, 57, 60],
          [41, 48, 53, 57],
          [43, 50, 55, 59],
        ]
      : kind === 1
        ? [
            [45, 52, 59, 60, 64],
            [41, 48, 52, 59],
            [36, 48, 55, 62],
            [43, 50, 57, 62],
          ]
        : [
            [41, 53, 57, 60],
            [45, 52, 57, 60],
            [48, 55, 59, 64],
            [43, 50, 55, 59],
          ];

  if (kind === 2) {
    // Yumuşak arpej + bas
    for (let bar = 0; bar < 4; bar += 1) {
      const chord = chords[bar];
      addTone(chord[0] - 12, bar * 4, 3.6, 0.22, [1, 0.3], "pad");
      for (let step = 0; step < 8; step += 1) {
        const note = chord[step % chord.length];
        addTone(note + 12, bar * 4 + step * 0.5, 0.9, 0.2, [], "pluck");
      }
    }
  } else {
    for (let bar = 0; bar < 4; bar += 1) {
      const chord = chords[bar];
      for (const note of chord) {
        addTone(note, bar * 4, 4.6, kind === 0 ? 0.15 : 0.13, [1, 0.32, 0.12], "pad");
      }
      addTone(chord[0] - 12, bar * 4, 3.4, 0.16, [1, 0.2], "pad");
    }
  }

  // Kısa, yumuşak gecikme (reverb yerine)
  const delays = [0.13, 0.27, 0.41];
  for (const seconds of delays) {
    const offset = Math.round(seconds * SAMPLE_RATE);
    for (let i = offset; i < length; i += 1) {
      mix[i] += mix[i - offset] * 0.16;
    }
  }

  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  const scale = peak > 0 ? 0.62 / peak : 1;
  const fade = Math.floor(SAMPLE_RATE * 1.2);
  const samples = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    let value = mix[i] * scale;
    if (i < fade) value *= i / fade;
    if (i > length - fade) value *= (length - i) / fade;
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
  }

  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }
  return buffer;
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

async function download(url, destination) {
  if (existsSync(destination)) return readFileSync(destination);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  return readFileSync(destination);
}

function makeZip(files) {
  return zipSync(files, { level: 9 });
}

function writePack(file, zip) {
  writeFileSync(join(outDir, file), zip);
  const sha256 = createHash("sha256").update(zip).digest("hex");
  console.log(`[packs] ${file} · ${(zip.length / 1024).toFixed(1)} KB · ${sha256.slice(0, 12)}…`);
  return { size: zip.length, sha256 };
}

function json(value) {
  return strToU8(JSON.stringify(value, null, 2));
}

/* ------------------------------------------------------------------ */
/* Paketler                                                            */
/* ------------------------------------------------------------------ */

const packs = [];

// 1) Ekstra geçişler (JSON)
{
  const content = {
    id: "extra-transitions",
    kind: "transitions",
    version: 1,
    title: { tr: "Ekstra Geçişler", en: "Extra Transitions" },
    license: "CC0-1.0",
    source: SOURCE,
    items: [
      { id: "blur", title: { tr: "Bulanık", en: "Blur" } },
      { id: "flash", title: { tr: "Flaş", en: "Flash" } },
    ],
  };
  const file = "pack-extra-transitions-v1.zip";
  const info = writePack(file, makeZip({ "pack.json": json(content) }));
  packs.push({
    id: content.id,
    kind: content.kind,
    title: content.title,
    description: {
      tr: "Yumuşak bulanıklaşma ve kısa flaş geçişleri.",
      en: "Soft blur and quick flash transitions.",
    },
    version: 1,
    file,
    license: content.license,
    source: content.source,
    ...info,
  });
}

// 2) Ekstra filtre ön ayarları (JSON)
{
  const content = {
    id: "film-filters",
    kind: "filters",
    version: 1,
    title: { tr: "Film Filtreleri", en: "Film Filters" },
    license: "CC0-1.0",
    source: SOURCE,
    items: [
      {
        id: "warm",
        title: { tr: "Sıcak", en: "Warm" },
        brightness: 3,
        contrast: 6,
        saturation: 8,
      },
      {
        id: "cool",
        title: { tr: "Soğuk", en: "Cool" },
        brightness: 0,
        contrast: 8,
        saturation: -10,
      },
      {
        id: "matte",
        title: { tr: "Mat", en: "Matte" },
        brightness: 5,
        contrast: -8,
        saturation: -12,
      },
      {
        id: "faded",
        title: { tr: "Soluk", en: "Faded" },
        brightness: 8,
        contrast: -14,
        saturation: -20,
      },
    ],
  };
  const file = "pack-film-filters-v1.zip";
  const info = writePack(file, makeZip({ "pack.json": json(content) }));
  packs.push({
    id: content.id,
    kind: content.kind,
    title: content.title,
    description: {
      tr: "Dört hazır renk ön ayarı; kaydırıcılarla ince ayar yapılabilir.",
      en: "Four colour presets; fine-tune them with the sliders.",
    },
    version: 1,
    file,
    license: content.license,
    source: content.source,
    ...info,
  });
}

// 3) Fontlar (OFL)
{
  const fonts = [
    {
      id: "outfit",
      label: "Outfit",
      file: "Outfit.ttf",
      url: "https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit%5Bwght%5D.ttf",
      licenseUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/OFL.txt",
    },
    {
      id: "bitter",
      label: "Bitter",
      file: "Bitter.ttf",
      url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bitter/Bitter%5Bwght%5D.ttf",
      licenseUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/bitter/OFL.txt",
    },
    {
      id: "jetbrains-mono",
      label: "JetBrains Mono",
      file: "JetBrainsMono.ttf",
      url: "https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
      licenseUrl:
        "https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/OFL.txt",
    },
  ];
  const files = {};
  const items = [];
  for (const font of fonts) {
    const bytes = await download(font.url, join(workDir, `${font.id}.ttf`));
    const license = await download(font.licenseUrl, join(workDir, `${font.id}-OFL.txt`));
    files[font.file] = new Uint8Array(bytes);
    files[`OFL-${font.id}.txt`] = new Uint8Array(license);
    items.push({
      id: font.id,
      label: font.label,
      file: font.file,
      license: "OFL-1.1",
      licenseFile: `OFL-${font.id}.txt`,
      source: font.url,
    });
  }
  const content = {
    id: "extra-fonts",
    kind: "fonts",
    version: 1,
    title: { tr: "Ekstra Fontlar", en: "Extra Fonts" },
    license: "OFL-1.1",
    source: SOURCE,
    items,
  };
  files["pack.json"] = json(content);
  const file = "pack-extra-fonts-v1.zip";
  const info = writePack(file, makeZip(files));
  packs.push({
    id: content.id,
    kind: content.kind,
    title: content.title,
    description: {
      tr: "Outfit, Bitter ve JetBrains Mono. SIL OFL 1.1 lisanslı.",
      en: "Outfit, Bitter and JetBrains Mono. Licensed under SIL OFL 1.1.",
    },
    version: 1,
    file,
    license: content.license,
    source: content.source,
    ...info,
  });
}

// 4) Mat çıkartmalar (CC0)
{
  const files = {};
  const items = [];
  for (const sticker of STICKERS) {
    const png = renderSticker(sticker.shape, sticker.color);
    const name = `${sticker.id}.png`;
    files[name] = new Uint8Array(png);
    items.push({ id: sticker.id, label: sticker.id, file: name, license: "CC0-1.0" });
  }
  const content = {
    id: "matte-stickers",
    kind: "stickers",
    version: 1,
    title: { tr: "Mat Çıkartmalar", en: "Matte Stickers" },
    license: "CC0-1.0",
    source: SOURCE,
    artist: "BeyTool",
    items,
  };
  files["pack.json"] = json(content);
  const file = "pack-matte-stickers-v1.zip";
  const info = writePack(file, makeZip(files));
  packs.push({
    id: content.id,
    kind: content.kind,
    title: content.title,
    description: {
      tr: "Altı sade, mat çıkartma. BeyTool tarafından üretildi (CC0).",
      en: "Six plain matte stickers, made by BeyTool (CC0).",
    },
    version: 1,
    file,
    license: content.license,
    source: content.source,
    ...info,
  });
}

// 5) Müzik (CC0)
{
  const tracks = [
    { id: "sakin-sabah", title: { tr: "Sakin Sabah", en: "Calm Morning" }, kind: 0 },
    { id: "gece-yuruyusu", title: { tr: "Gece Yürüyüşü", en: "Night Walk" }, kind: 1 },
    { id: "kucuk-adim", title: { tr: "Küçük Adım", en: "Small Step" }, kind: 2 },
  ];
  const files = {};
  const items = [];
  for (const track of tracks) {
    const wav = renderMusic(track.kind);
    const name = `${track.id}.wav`;
    files[name] = new Uint8Array(wav);
    items.push({
      id: track.id,
      title: track.title,
      artist: "BeyTool",
      file: name,
      license: "CC0-1.0",
      duration: DURATION,
    });
  }
  const content = {
    id: "ambient-music",
    kind: "music",
    version: 1,
    title: { tr: "Sakin Müzik", en: "Ambient Music" },
    license: "CC0-1.0",
    source: SOURCE,
    artist: "BeyTool",
    items,
  };
  files["pack.json"] = json(content);
  const file = "pack-ambient-music-v1.zip";
  const info = writePack(file, makeZip(files));
  packs.push({
    id: content.id,
    kind: content.kind,
    title: content.title,
    description: {
      tr: "Üç kısa, sakin enstrümantal döngü. BeyTool tarafından üretildi (CC0).",
      en: "Three short calm instrumental loops, made by BeyTool (CC0).",
    },
    version: 1,
    file,
    license: content.license,
    source: content.source,
    ...info,
  });
}

const manifest = {
  manifestVersion: 1,
  releasedAt: new Date().toISOString().slice(0, 10),
  baseUrl: BASE_URL,
  packs,
};

writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
mkdirSync(join(root, "src", "packs"), { recursive: true });
writeFileSync(
  join(root, "src", "packs", "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`[packs] ${packs.length} paket + manifest hazır → packs-dist/`);
