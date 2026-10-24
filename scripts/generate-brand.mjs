// Mat, iOS tarzı marka görselleri üretir: uygulama ikonu + açılış ekranları.
// Harici araç gerekmez; PNG'ler zlib ile doğrudan yazılır.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const RES = "android/app/src/main/res";
const PUBLIC = "public";

/* ----------------------------- PNG yazımı ----------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ----------------------------- Çizim ----------------------------- */

class Raster {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.px = new Float32Array(width * height * 4);
  }

  blend(x, y, r, g, b, a) {
    if (a <= 0) return;
    const i = (y * this.w + x) * 4;
    const da = this.px[i + 3];
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    this.px[i] = (r * a + this.px[i] * da * (1 - a)) / oa;
    this.px[i + 1] = (g * a + this.px[i + 1] * da * (1 - a)) / oa;
    this.px[i + 2] = (b * a + this.px[i + 2] * da * (1 - a)) / oa;
    this.px[i + 3] = oa;
  }

  /** SDF tabanlı dolgu; color(x, y) => [r,g,b,a] (0..1). */
  fill(sdf, color) {
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        const d = sdf(x + 0.5, y + 0.5);
        const cov = Math.min(1, Math.max(0, 0.5 - d));
        if (cov <= 0) continue;
        const [r, g, b, a] = color(x + 0.5, y + 0.5);
        this.blend(x, y, r, g, b, a * cov);
      }
    }
  }

  toBuffer() {
    const out = new Uint8Array(this.w * this.h * 4);
    for (let i = 0; i < out.length; i += 4) {
      out[i] = Math.round(Math.min(1, Math.max(0, this.px[i])) * 255);
      out[i + 1] = Math.round(Math.min(1, Math.max(0, this.px[i + 1])) * 255);
      out[i + 2] = Math.round(Math.min(1, Math.max(0, this.px[i + 2])) * 255);
      out[i + 3] = Math.round(Math.min(1, Math.max(0, this.px[i + 3])) * 255);
    }
    return out;
  }
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function sdRoundedRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const e0x = bx - ax;
  const e0y = by - ay;
  const e1x = cx - bx;
  const e1y = cy - by;
  const e2x = ax - cx;
  const e2y = ay - cy;
  const v0x = px - ax;
  const v0y = py - ay;
  const v1x = px - bx;
  const v1y = py - by;
  const v2x = px - cx;
  const v2y = py - cy;
  const t0 = clamp01((v0x * e0x + v0y * e0y) / (e0x * e0x + e0y * e0y));
  const t1 = clamp01((v1x * e1x + v1y * e1y) / (e1x * e1x + e1y * e1y));
  const t2 = clamp01((v2x * e2x + v2y * e2y) / (e2x * e2x + e2y * e2y));
  const pq0x = v0x - e0x * t0;
  const pq0y = v0y - e0y * t0;
  const pq1x = v1x - e1x * t1;
  const pq1y = v1y - e1y * t1;
  const pq2x = v2x - e2x * t2;
  const pq2y = v2y - e2y * t2;
  const s = Math.sign(e0x * e2y - e0y * e2x);
  const d0 = [pq0x * pq0x + pq0y * pq0y, s * (v0x * e0y - v0y * e0x)];
  const d1 = [pq1x * pq1x + pq1y * pq1y, s * (v1x * e1y - v1y * e1x)];
  const d2 = [pq2x * pq2x + pq2y * pq2y, s * (v2x * e2y - v2y * e2x)];
  const d = [d0, d1, d2].reduce((best, cur) =>
    cur[0] < best[0] || (cur[0] === best[0] && cur[1] < best[1]) ? cur : best,
  );
  return -Math.sqrt(d[0]) * Math.sign(d[1]);
}

const GRAPHITE_TOP = [0.176, 0.176, 0.184];
const GRAPHITE_BOTTOM = [0.102, 0.102, 0.110];
const IVORY = [0.937, 0.925, 0.898];

/** Koyu mat karo + fildişi play glifi. */
function drawMark(raster, cx, cy, size, glyphRatio = 0.46, shadow = false) {
  const hw = size / 2;
  const radius = size * 0.235;
  if (shadow) {
    for (let i = 18; i >= 1; i -= 1) {
      const grow = i * size * 0.012;
      raster.fill(
        (x, y) => sdRoundedRect(x, y, cx, cy + size * 0.02, hw + grow, hw + grow, radius + grow),
        () => [0, 0, 0, 0.012],
      );
    }
  }

  raster.fill(
    (x, y) => sdRoundedRect(x, y, cx, cy, hw, hw, radius),
    (_x, y) => {
      const t = clamp01((y - (cy - hw)) / (2 * hw));
      const r = GRAPHITE_TOP[0] + (GRAPHITE_BOTTOM[0] - GRAPHITE_TOP[0]) * t;
      const g = GRAPHITE_TOP[1] + (GRAPHITE_BOTTOM[1] - GRAPHITE_TOP[1]) * t;
      const b = GRAPHITE_TOP[2] + (GRAPHITE_BOTTOM[2] - GRAPHITE_TOP[2]) * t;
      return [r, g, b, 1];
    },
  );

  // Mat yüzeyde çok hafif üst ışığı (parlaklık değil, derinlik).
  raster.fill(
    (x, y) => sdRoundedRect(x, y, cx, cy - hw * 0.18, hw * 0.94, hw * 0.54, radius * 0.8),
    (_x, y) => {
      const t = clamp01((y - (cy - hw)) / (hw * 1.4));
      return [1, 1, 1, 0.028 * (1 - t)];
    },
  );

  // Kenar çizgisi: koyu zeminde karoyu ayırır.
  raster.fill(
    (x, y) => Math.abs(sdRoundedRect(x, y, cx, cy, hw, hw, radius)) - Math.max(1, size * 0.004),
    () => [1, 1, 1, 0.07],
  );

  const gw = size * glyphRatio;
  const gh = gw * 1.16;
  const gx = cx - gw * 0.02;
  const gy = cy;
  const rounding = gw * 0.13;
  const left = gx - gw / 2 + rounding * 0.2;
  const right = gx + gw / 2;
  const top = gy - gh / 2;
  const bottom = gy + gh / 2;

  raster.fill(
    (x, y) =>
      sdTriangle(x, y, left, top, left, bottom, right, gy) + rounding,
    () => [IVORY[0], IVORY[1], IVORY[2], 1],
  );
}

function solidCanvas(width, height, color) {
  const raster = new Raster(width, height);
  raster.fill(() => -1, color);
  return raster;
}

function gradientCanvas(width, height, top, bottom) {
  const raster = new Raster(width, height);
  raster.fill(
    () => -1,
    (_x, y) => {
      const t = clamp01(y / Math.max(1, height - 1));
      return [
        top[0] + (bottom[0] - top[0]) * t,
        top[1] + (bottom[1] - top[1]) * t,
        top[2] + (bottom[2] - top[2]) * t,
        1,
      ];
    },
  );
  return raster;
}

/* ----------------------------- Çıktılar ----------------------------- */

function write(path, buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
}

function iconLegacy(size) {
  const raster = new Raster(size, size);
  const inset = size * 0.035;
  const radius = size * 0.225;
  raster.fill(
    (x, y) => sdRoundedRect(x, y, size / 2, size / 2, size / 2 - inset, size / 2 - inset, radius),
    (_x, y) => {
      const t = clamp01(y / size);
      return [
        GRAPHITE_TOP[0] + (GRAPHITE_BOTTOM[0] - GRAPHITE_TOP[0]) * t,
        GRAPHITE_TOP[1] + (GRAPHITE_BOTTOM[1] - GRAPHITE_TOP[1]) * t,
        GRAPHITE_TOP[2] + (GRAPHITE_BOTTOM[2] - GRAPHITE_TOP[2]) * t,
        1,
      ];
    },
  );
  const gw = size * 0.42;
  const gh = gw * 1.16;
  const cx = size / 2;
  const cy = size / 2;
  raster.fill(
    (x, y) => sdTriangle(x, y, cx - gw / 2 + gw * 0.05, cy - gh / 2, cx - gw / 2 + gw * 0.05, cy + gh / 2, cx + gw / 2, cy) + gw * 0.13,
    () => [IVORY[0], IVORY[1], IVORY[2], 1],
  );
  return raster.toBuffer();
}

function adaptiveForeground(size) {
  const raster = new Raster(size, size);
  const gw = size * 0.40;
  const gh = gw * 1.16;
  const cx = size / 2;
  const cy = size / 2;
  raster.fill(
    (x, y) => sdTriangle(x, y, cx - gw / 2 + gw * 0.05, cy - gh / 2, cx - gw / 2 + gw * 0.05, cy + gh / 2, cx + gw / 2, cy) + gw * 0.13,
    () => [IVORY[0], IVORY[1], IVORY[2], 1],
  );
  return raster.toBuffer();
}

function splash(width, height, mode) {
  const light = mode === "light";
  const raster = light
    ? gradientCanvas(width, height, [0.956, 0.956, 0.968], [0.918, 0.918, 0.933])
    : gradientCanvas(width, height, [0.063, 0.063, 0.070], [0.035, 0.035, 0.040]);

  // Hafif mat vinyet; neon yok.
  raster.fill(
    () => -1,
    (x, y) => {
      const nx = (x - width / 2) / (width / 2);
      const ny = (y - height / 2) / (height / 2);
      const d = Math.min(1, Math.hypot(nx, ny) / 1.4);
      return [light ? 0.35 : 0, light ? 0.35 : 0, light ? 0.38 : 0, light ? 0.05 * d : 0.12 * d];
    },
  );

  const size = Math.min(width, height) * 0.28;
  drawMark(raster, width / 2, height / 2 - size * 0.04, size, 0.44, true);

  // Mat zemin üstünde ince bir taban çizgisi (marka vurgusu).
  const lineW = size * 0.36;
  const lineY = height / 2 + size * 0.62;
  raster.fill(
    (x, y) => sdRoundedRect(x, y, width / 2, lineY, lineW, Math.max(1, size * 0.006), Math.max(1, size * 0.006)),
    () => [light ? 0.25 : 0.9, light ? 0.25 : 0.88, light ? 0.27 : 0.84, light ? 0.35 : 0.28],
  );
  return raster.toBuffer();
}

const ICON_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

for (const [density, size] of Object.entries(ICON_SIZES)) {
  write(join(RES, `mipmap-${density}`, "ic_launcher.png"), encodePng(size, size, iconLegacy(size)));
  write(join(RES, `mipmap-${density}`, "ic_launcher_round.png"), encodePng(size, size, iconLegacy(size)));
  const fg = Math.round(size * 2.25);
  write(join(RES, `mipmap-${density}`, "ic_launcher_foreground.png"), encodePng(fg, fg, adaptiveForeground(fg)));
}

const SPLASH = {
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
};

write(join(RES, "drawable", "splash.png"), encodePng(480, 320, splash(480, 320, "light")));
write(join(RES, "drawable-night", "splash.png"), encodePng(480, 320, splash(480, 320, "dark")));

for (const [dir, [width, height]] of Object.entries(SPLASH)) {
  write(join(RES, dir, "splash.png"), encodePng(width, height, splash(width, height, "light")));
  const nightDir = dir.replace(/^drawable-(port|land)-/, "drawable-$1-night-");
  write(join(RES, nightDir, "splash.png"), encodePng(width, height, splash(width, height, "dark")));
}

write(join(PUBLIC, "apple-touch-icon.png"), encodePng(180, 180, iconLegacy(180)));
write(join(PUBLIC, "icon-512.png"), encodePng(512, 512, iconLegacy(512)));

console.log("Marka görselleri üretildi.");
