import { Mp3Encoder } from "@breezystack/lamejs";
import { zipSync } from "fflate";

const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

function yieldToUI() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Videodan/ses dosyasından PCM çözümleyer.
 * Cihazın çözücüsü desteklemiyorsa net bir hata fırlatır.
 */
export async function decodeToAudioBuffer(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  const CtxCtor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!CtxCtor) throw new Error("Bu cihazda ses çözümleyici bulunamadı.");
  const ctx = new CtxCtor();
  try {
    const buffer = await ctx.decodeAudioData(data);
    return buffer;
  } catch {
    throw new Error(
      "Bu dosyanın sesi çözülemedi. Cihazın o codec'i desteklemiyor olabilir; farklı bir dosya deneyin.",
    );
  } finally {
    void ctx.close();
  }
}

/** lamejs yalnızca belirli örnekleme oranlarını destekler; gerekirse yeniden örnekler. */
async function ensureMp3SampleRate(buffer: AudioBuffer): Promise<AudioBuffer> {
  if (MP3_RATES.includes(buffer.sampleRate)) return buffer;
  const targetRate = 44100;
  const length = Math.ceil((buffer.duration * targetRate));
  const offline = new OfflineAudioContext(buffer.numberOfChannels, length, targetRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function encodeMp3(
  buffer: AudioBuffer,
  kbps: number,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const src = await ensureMp3SampleRate(buffer);
  const channels = Math.min(2, src.numberOfChannels);
  const encoder = new Mp3Encoder(channels, src.sampleRate, kbps);

  const left = floatTo16BitPCM(src.getChannelData(0));
  const right = channels > 1 ? floatTo16BitPCM(src.getChannelData(1)) : null;

  const blockSize = 1152;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const total = left.length;

  for (let i = 0; i < total; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right ? right.subarray(i, i + blockSize) : undefined;
    const encoded = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));

    if (i % (blockSize * 400) === 0) {
      onProgress(i / total);
      await yieldToUI();
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));
  onProgress(1);

  return new Blob(chunks, { type: "audio/mpeg" });
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) channelData.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const s = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/** Buffer'ın [start, end] saniye aralığını kopyalar. */
export function sliceBuffer(buffer: AudioBuffer, start: number, end: number): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startFrame = Math.max(0, Math.floor(start * sampleRate));
  const endFrame = Math.min(buffer.length, Math.floor(end * sampleRate));
  const frames = Math.max(1, endFrame - startFrame);
  const out = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: frames,
    sampleRate,
  });
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    out.copyToChannel(buffer.getChannelData(c).subarray(startFrame, endFrame), c);
  }
  return out;
}

export type ImageOptions = {
  maxWidth?: number;
  quality: number;
  type: "image/jpeg" | "image/png" | "image/webp";
};

export async function processImage(file: File, opts: ImageOptions): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Bu görsel çözülemedi. Cihaz bu formatı (ör. HEIC) açamıyor olabilir; JPG/PNG bir dosya deneyin.",
    );
  }

  try {
    const scale = opts.maxWidth && bitmap.width > opts.maxWidth ? opts.maxWidth / bitmap.width : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tuval oluşturulamadı.");
    if (opts.type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, opts.type, opts.quality),
    );
    if (!blob) throw new Error("Görsel oluşturulamadı.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function sha256Hex(
  file: File,
  onProgress: (ratio: number) => void,
): Promise<string> {
  if (!crypto.subtle) throw new Error("Bu ortamda parmak izi (hash) desteği yok.");
  const chunkSize = 8 * 1024 * 1024;
  const parts: ArrayBuffer[] = [];
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(file.size, offset + chunkSize);
    parts.push(await file.slice(offset, end).arrayBuffer());
    offset = end;
    onProgress((offset / file.size) * 0.9);
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    parts.length === 1 ? parts[0] : await new Blob(parts).arrayBuffer(),
  );
  onProgress(1);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createZip(
  files: File[],
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  let done = 0;
  for (const file of files) {
    let name = file.name;
    let n = 2;
    while (used.has(name)) {
      const dot = file.name.lastIndexOf(".");
      name =
        dot === -1
          ? `${file.name} (${n})`
          : `${file.name.slice(0, dot)} (${n})${file.name.slice(dot)}`;
      n += 1;
    }
    used.add(name);
    entries[name] = new Uint8Array(await file.arrayBuffer());
    done += 1;
    onProgress((done / files.length) * 0.8);
    await yieldToUI();
  }
  const zipped = zipSync(entries, { level: 6 });
  onProgress(1);
  return new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
}

/** Videonun belirli bir saniyesinden PNG kare çıkarır. */
export async function captureFrame(
  url: string,
  time: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), 15000);
    video.onloadeddata = () => {
      window.clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("load"));
    };
  });

  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = Math.max(0, time);
  });

  try {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error("size");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("encode");
    return { blob, width, height };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

export type VideoMeta = {
  duration: number;
  width: number;
  height: number;
  type: string;
};

export function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video bilgisi okunamadı (zaman aşımı)."));
    }, 15000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const meta: VideoMeta = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        type: file.type || "bilinmiyor",
      };
      cleanup();
      resolve(meta);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(
        new Error("Bu video bu cihazda açılamıyor. Cihazın desteklediği bir format deneyin."),
      );
    };
    video.src = url;
  });
}

export type CodecProbe = { label: string; mime: string; supported: boolean };

/** Cihazın hangi video/ses codec'lerini oynatabildiğini (WebView'a göre) bildirir. */
export function probeCodecs(): CodecProbe[] {
  const probes: { label: string; mime: string }[] = [
    { label: "MP4 / H.264 + AAC", mime: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
    { label: "MP4 / H.265 (HEVC)", mime: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
    { label: "WebM / VP9 + Opus", mime: 'video/webm; codecs="vp9, opus"' },
    { label: "WebM / VP8", mime: 'video/webm; codecs="vp8, vorbis"' },
    { label: "MKV / AVI / FLV", mime: "video/x-matroska" },
    { label: "Ses: MP3", mime: "audio/mpeg" },
    { label: "Ses: AAC / M4A", mime: "audio/aac" },
    { label: "Ses: FLAC", mime: "audio/flac" },
  ];
  const probe = document.createElement("video");
  return probes.map((p) => ({
    ...p,
    supported: probe.canPlayType(p.mime) === "probably",
  }));
}
