import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import {
  FFmpegCancelledError,
  execFFmpeg,
  ffmpegExtension,
  getFFmpeg,
  isFFmpegCancelled,
} from "@/lib/ffmpeg";
import { extensionOf } from "@/lib/storage";
import type { Entry } from "@/lib/library";
import type { Clip, ExportQuality, Project } from "./types";
import {
  aspectSize,
  audioTracks,
  clipEnd,
  mainVideoTrack,
  overlayTracks,
  projectDuration,
  sortedClips,
  textTracks,
} from "./types";
import { resolveEntry } from "./media";

export type ExportResult = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
};

export type ExportOptions = {
  project: Project;
  entries: Entry[];
  quality: ExportQuality;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
};

type SourceFile = {
  name: string;
  hasAudio: boolean;
};

function num(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}

function atempo(speed: number): string {
  if (Math.abs(speed - 1) < 0.001) return "";
  let remaining = speed;
  const parts: string[] = [];
  while (remaining > 2.001) {
    parts.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.499) {
    parts.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) > 0.001) parts.push(`atempo=${num(remaining)}`);
  return parts.join(",");
}

async function probeAudio(
  ffmpeg: FFmpeg,
  fileName: string,
  signal?: AbortSignal,
): Promise<boolean> {
  let hasAudio = false;
  const handler = (event: { message: string }) => {
    if (/Stream #\d+:\d+.*: Audio:/.test(event.message)) hasAudio = true;
  };
  ffmpeg.on("log", handler);
  try {
    await ffmpeg.exec(["-hide_banner", "-i", fileName], 20_000, { signal });
  } catch {
    // Girdi incelemesi her zaman sıfırdan farklı kodla biter.
  } finally {
    ffmpeg.off("log", handler);
  }
  if (signal?.aborted) throw new FFmpegCancelledError();
  return hasAudio;
}

async function writeSources(
  ffmpeg: FFmpeg,
  entries: Entry[],
  clips: Clip[],
  signal?: AbortSignal,
  onProgress?: (ratio: number) => void,
): Promise<Map<string, SourceFile>> {
  const sources = new Map<string, SourceFile>();
  const unique = new Map<string, Entry>();
  for (const clip of clips) {
    if (clip.kind === "text") continue;
    const entry = resolveEntry(clip, entries);
    if (!entry) {
      throw new Error(`Kaynak bulunamadı: ${clip.name}`);
    }
    unique.set(entry.id, entry);
  }

  let index = 0;
  const total = Math.max(1, unique.size);
  for (const entry of unique.values()) {
    if (signal?.aborted) throw new FFmpegCancelledError();
    const extension = ffmpegExtension(entry.name) || extensionOf(entry.name);
    const fileName = `src_${index}.${extension.replace(/[^a-z0-9]/gi, "") || "bin"}`;
    const data = await fetchFile(entry.file);
    await ffmpeg.writeFile(fileName, data);
    const hasAudio =
      entry.kind === "video" ? await probeAudio(ffmpeg, fileName, signal) : false;
    sources.set(entry.id, { name: fileName, hasAudio });
    index += 1;
    onProgress?.((index / total) * 0.06);
  }
  return sources;
}

function textFont(font: string): string {
  if (font === "serif") return "Georgia, 'Times New Roman', serif";
  if (font === "mono") return "ui-monospace, SFMono-Regular, Menlo, monospace";
  return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
}

async function renderTextPng(
  clip: Clip,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const text = clip.text;
  if (!text) throw new Error("Metin klibi boş.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Metin çizimi başlatılamadı.");
  context.clearRect(0, 0, width, height);

  const fontSize = Math.max(12, (text.size / 1080) * width);
  const family = textFont(text.font);
  context.font = `600 ${fontSize}px ${family}`;
  context.textBaseline = "middle";
  context.textAlign = text.align;
  context.fillStyle = text.color;
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = Math.max(2, (14 / 1080) * width);
  context.shadowOffsetY = Math.max(1, (2 / 1080) * width);

  const maxWidth = width * 0.86;
  const words = text.content.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length === 0) lines.push("");

  const lineHeight = fontSize * 1.18;
  const totalHeight = lines.length * lineHeight;
  const x = text.align === "left" ? width * 0.07 : text.align === "right" ? width * 0.93 : width / 2;
  let y = height / 2 - totalHeight / 2 + lineHeight / 2;
  for (const item of lines) {
    context.fillText(item, x, y, maxWidth);
    y += lineHeight;
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), "image/png"),
  );
  if (!blob) throw new Error("Metin görüntüsü oluşturulamadı.");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportProject({
  project,
  entries,
  quality,
  onProgress,
  signal,
}: ExportOptions): Promise<ExportResult> {
  const duration = projectDuration(project);
  if (duration <= 0.05) {
    throw new Error("Zaman çizelgesi boş.");
  }

  const { width, height } = aspectSize(project.aspect, quality);
  const ffmpeg = await getFFmpeg();
  onProgress?.(0.01);
  if (signal?.aborted) throw new FFmpegCancelledError();

  const usedClips = project.tracks.flatMap((track) =>
    track.clips.filter((clip) => clip.kind !== "text"),
  );
  const sources = await writeSources(ffmpeg, entries, usedClips, signal, onProgress);

  const inputArgs: string[] = [];
  const filters: string[] = [];
  const written: string[] = [...sources.values()].map((source) => source.name);
  let inputCount = 0;

  const addInput = (args: string[]): number => {
    inputArgs.push(...args);
    const index = inputCount;
    inputCount += 1;
    return index;
  };

  type Segment = { video: string; audio: string };
  const segments: Segment[] = [];
  let cursor = 0;

  const addGap = (seconds: number) => {
    const index = segments.length;
    const v = `v${index}`;
    const a = `a${index}`;
    filters.push(
      `color=c=black:s=${width}x${height}:r=30:d=${num(seconds)},format=yuv420p[${v}]`,
    );
    filters.push(
      `anullsrc=r=44100:cl=stereo,atrim=duration=${num(seconds)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[${a}]`,
    );
    segments.push({ video: v, audio: a });
  };

  const addSegment = (clip: Clip) => {
    const entry = resolveEntry(clip, entries);
    if (!entry) throw new Error(`Kaynak bulunamadı: ${clip.name}`);
    const source = sources.get(entry.id);
    if (!source) throw new Error(`Kaynak yazılamadı: ${clip.name}`);

    const index = segments.length;
    const v = `v${index}`;
    const a = `a${index}`;
    const isImage = clip.kind === "image";
    const frozen = clip.kind === "video" && clip.freezeAt !== undefined;
    const span = frozen
      ? clip.duration
      : isImage
        ? clip.duration
        : Math.max(
            0.05,
            Math.min(
              clip.duration * clip.speed,
              Math.max(0.05, clip.sourceDuration - clip.inPoint),
            ),
          );
    const inputIndex = addInput(
      isImage
        ? ["-loop", "1", "-t", num(clip.duration + 0.2), "-i", source.name]
        : ["-i", source.name],
    );

    const videoFilters: string[] = [];
    if (frozen) {
      videoFilters.push(
        `trim=start=${num(clip.freezeAt!)}:duration=0.05`,
        "setpts=PTS-STARTPTS",
        "loop=loop=-1:size=1:start=0",
        `trim=duration=${num(clip.duration)}`,
        "setpts=PTS-STARTPTS",
      );
    } else if (!isImage) {
      videoFilters.push(
        `trim=start=${num(clip.inPoint)}:duration=${num(span)}`,
        "setpts=PTS-STARTPTS",
      );
      if (clip.reverse) videoFilters.push("reverse", "setpts=PTS-STARTPTS");
      if (Math.abs(clip.speed - 1) > 0.001) {
        videoFilters.push(`setpts=PTS/${num(clip.speed)}`);
      }
    } else {
      videoFilters.push(`trim=duration=${num(clip.duration)}`, "setpts=PTS-STARTPTS");
    }

    if (clip.rotate === 90) videoFilters.push("transpose=1");
    else if (clip.rotate === 180) videoFilters.push("transpose=2", "transpose=2");
    else if (clip.rotate === 270) videoFilters.push("transpose=2");
    if (clip.flipH) videoFilters.push("hflip");
    if (clip.flipV) videoFilters.push("vflip");

    videoFilters.push(
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    );

    if (isImage && clip.kenBurns) {
      const frames = Math.max(1, Math.round(30 * clip.duration));
      videoFilters.push(
        `zoompan=z='min(1.1,1+0.10*on/${frames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=30`,
      );
    }

    const eqParts: string[] = [];
    if (Math.abs(clip.filter.brightness) > 0.01) {
      eqParts.push(`brightness=${num(clip.filter.brightness / 100)}`);
    }
    if (Math.abs(clip.filter.contrast) > 0.01) {
      eqParts.push(`contrast=${num(1 + clip.filter.contrast / 100)}`);
    }
    if (Math.abs(clip.filter.saturation) > 0.01) {
      eqParts.push(`saturation=${num(1 + clip.filter.saturation / 100)}`);
    }
    if (eqParts.length > 0) videoFilters.push(`eq=${eqParts.join(":")}`);
    if (clip.filter.preset === "bw") videoFilters.push("hue=s=0");
    if (clip.filter.preset === "sepia") {
      videoFilters.push(
        "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131",
      );
    }
    if (clip.filter.preset === "vignette") videoFilters.push("vignette=PI/4");

    videoFilters.push("setsar=1", "fps=30", "format=yuv420p");

    const fadeIn = Math.max(0, Math.min(clip.fadeIn, clip.duration / 2));
    const fadeOut = Math.max(0, Math.min(clip.fadeOut, clip.duration / 2));
    const transitionDuration = Math.max(
      0.2,
      Math.min(clip.transitionDuration, clip.duration / 2),
    );
    if (clip.transitionIn === "fade") {
      videoFilters.push(`fade=t=in:st=0:d=${num(transitionDuration)}`);
    }
    if (fadeIn > 0.01) {
      videoFilters.push(`fade=t=in:st=0:d=${num(fadeIn)}`);
    }
    if (fadeOut > 0.01) {
      videoFilters.push(
        `fade=t=out:st=${num(Math.max(0, clip.duration - fadeOut))}:d=${num(fadeOut)}`,
      );
    }

    if (clip.transitionIn === "zoom") {
      const frames = Math.max(1, Math.round(30 * transitionDuration));
      videoFilters.push(
        `zoompan=z='max(1,1.12-0.12*min(on/${frames},1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=30`,
        "setsar=1",
      );
    }

    if (clip.transitionIn === "slide") {
      const raw = `vraw${index}`;
      filters.push(`[${inputIndex}:v]${videoFilters.join(",")}[${raw}]`);
      filters.push(
        `color=c=black:s=${width}x${height}:r=30:d=${num(clip.duration)}[vslide${index}]`,
      );
      filters.push(
        `[vslide${index}][${raw}]overlay=x='if(lt(t,${num(transitionDuration)}),${width}*(1-t/${num(transitionDuration)}),0)':y=0:eval=frame:shortest=1[${v}]`,
      );
    } else {
      filters.push(`[${inputIndex}:v]${videoFilters.join(",")}[${v}]`);
    }

    // Donmuş karede ses kaynağı kare süresinden kısa kalıp concat'ı kısaltabilir;
    // bu yüzden donmuş klipler sessiz çıkar.
    const useAudio =
      !isImage &&
      !frozen &&
      clip.kind === "video" &&
      source.hasAudio &&
      clip.volume > 0.001;

    if (useAudio) {
      const audioFilters = [
        `atrim=start=${num(clip.inPoint)}:duration=${num(span)}`,
        "asetpts=PTS-STARTPTS",
      ];
      if (clip.reverse) audioFilters.push("areverse", "asetpts=PTS-STARTPTS");
      const tempo = atempo(clip.speed);
      if (tempo) audioFilters.push(tempo);
      audioFilters.push(`volume=${num(clip.volume)}`);
      if (fadeIn > 0.01) audioFilters.push(`afade=t=in:st=0:d=${num(fadeIn)}`);
      if (fadeOut > 0.01) {
        audioFilters.push(
          `afade=t=out:st=${num(Math.max(0, clip.duration - fadeOut))}:d=${num(fadeOut)}`,
        );
      }
      audioFilters.push(
        "aresample=44100",
        "aformat=sample_fmts=fltp:channel_layouts=stereo",
      );
      filters.push(`[${inputIndex}:a]${audioFilters.join(",")}[${a}]`);
    } else {
      filters.push(
        `anullsrc=r=44100:cl=stereo,atrim=duration=${num(clip.duration)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[${a}]`,
      );
    }

    segments.push({ video: v, audio: a });
    cursor = Math.max(cursor, clipEnd(clip));
  };

  const mainTrack = mainVideoTrack(project);
  const mainClips = mainTrack
    ? sortedClips(mainTrack).filter(
        (clip) => clip.kind === "video" || clip.kind === "image",
      )
    : [];

  for (const clip of mainClips) {
    if (clip.start > cursor + 0.01) addGap(clip.start - cursor);
    addSegment(clip);
  }
  if (duration > cursor + 0.01) addGap(duration - cursor);
  if (segments.length === 0) addGap(duration);

  if (segments.length === 1) {
    filters.push(`[${segments[0].video}]null[vbase]`);
    filters.push(`[${segments[0].audio}]anull[abase]`);
  } else {
    filters.push(
      `${segments.map((segment) => `[${segment.video}][${segment.audio}]`).join("")}concat=n=${segments.length}:v=1:a=1[vbase][abase]`,
    );
  }

  let videoLabel = "vbase";

  // --- Resim içinde resim: kaplama izleri ana videonun üzerine bindirilir ---
  const pipClips = overlayTracks(project)
    .flatMap((track) => sortedClips(track))
    .filter((clip) => clip.kind === "video" || clip.kind === "image");

  for (let index = 0; index < pipClips.length; index += 1) {
    const clip = pipClips[index];
    const entry = resolveEntry(clip, entries);
    if (!entry) throw new Error(`Kaynak bulunamadı: ${clip.name}`);
    const source = sources.get(entry.id);
    if (!source) throw new Error(`Kaynak yazılamadı: ${clip.name}`);
    const isImage = clip.kind === "image";
    const frozen = clip.kind === "video" && clip.freezeAt !== undefined;
    const scale = Math.max(0.1, Math.min(0.9, clip.pip?.scale ?? 0.35));
    const pipWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
    const pipHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
    const inputIndex = addInput(
      isImage
        ? ["-loop", "1", "-t", num(clip.duration + 0.2), "-i", source.name]
        : ["-i", source.name],
    );
    const span = frozen
      ? clip.duration
      : isImage
        ? clip.duration
        : Math.max(
            0.05,
            Math.min(
              clip.duration * clip.speed,
              Math.max(0.05, clip.sourceDuration - clip.inPoint),
            ),
          );
    const chain: string[] = [];
    if (frozen) {
      chain.push(
        `trim=start=${num(clip.freezeAt!)}:duration=0.05`,
        "setpts=PTS-STARTPTS",
        "loop=loop=-1:size=1:start=0",
        `trim=duration=${num(clip.duration)}`,
        "setpts=PTS-STARTPTS",
      );
    } else if (isImage) {
      chain.push(`trim=duration=${num(clip.duration)}`, "setpts=PTS-STARTPTS");
    } else {
      chain.push(
        `trim=start=${num(clip.inPoint)}:duration=${num(span)}`,
        "setpts=PTS-STARTPTS",
      );
      if (clip.reverse) chain.push("reverse", "setpts=PTS-STARTPTS");
      if (Math.abs(clip.speed - 1) > 0.001) chain.push(`setpts=PTS/${num(clip.speed)}`);
    }
    if (clip.rotate === 90) chain.push("transpose=1");
    else if (clip.rotate === 180) chain.push("transpose=2", "transpose=2");
    else if (clip.rotate === 270) chain.push("transpose=2");
    if (clip.flipH) chain.push("hflip");
    if (clip.flipV) chain.push("vflip");
    chain.push(
      `scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=decrease`,
      `pad=${pipWidth}:${pipHeight}:(ow-iw)/2:(oh-ih)/2:color=black`,
      "setsar=1",
      "fps=30",
      "format=yuv420p",
    );
    if (Math.abs(clip.filter.brightness) > 0.01 || Math.abs(clip.filter.contrast) > 0.01 || Math.abs(clip.filter.saturation) > 0.01) {
      chain.push(
        `eq=brightness=${num(clip.filter.brightness / 100)}:contrast=${num(1 + clip.filter.contrast / 100)}:saturation=${num(1 + clip.filter.saturation / 100)}`,
      );
    }
    if (clip.filter.preset === "bw") chain.push("hue=s=0");
    if (clip.filter.preset === "sepia") {
      chain.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131");
    }
    chain.push(`setpts=PTS+${num(clip.start)}/TB`);
    const label = `pip${index}`;
    filters.push(`[${inputIndex}:v]${chain.join(",")}[${label}]`);
    const next = `vpip${index}`;
    filters.push(
      `[${videoLabel}][${label}]overlay=x=${Math.round((clip.pip?.x ?? 0.6) * width)}:y=${Math.round((clip.pip?.y ?? 0.08) * height)}:enable='between(t,${num(clip.start)},${num(clipEnd(clip))})':eof_action=repeat[${next}]`,
    );
    videoLabel = next;
  }

  // --- Metin katmanları: şeffaf PNG'ler ana videonun üzerine bindirilir ---
  const textClips = textTracks(project)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.kind === "text" && !!clip.text?.content.trim())
    .sort((a, b) => a.start - b.start);

  for (let index = 0; index < textClips.length; index += 1) {
    const clip = textClips[index];
    if (signal?.aborted) throw new FFmpegCancelledError();
    const png = await renderTextPng(clip, width, height);
    const fileName = `text_${index}.png`;
    await ffmpeg.writeFile(fileName, png);
    written.push(fileName);
    const inputIndex = addInput([
      "-loop",
      "1",
      "-t",
      num(clip.duration + 0.2),
      "-i",
      fileName,
    ]);
    const label = `txt${index}`;
    const chain = ["format=rgba"];
    const text = clip.text!;
    const windowSeconds = 0.35;
    // Giriş/çıkış animasyonları PNG akışının kendi zamanında (0..süre) çalışır;
    // akış sonra ana zaman çizelgesine kaydırılır.
    if (text.animIn === "fade") {
      chain.push(`fade=t=in:st=0:d=${num(windowSeconds)}:alpha=1`);
    }
    if (text.animOut === "fade") {
      chain.push(
        `fade=t=out:st=${num(Math.max(0, clip.duration - windowSeconds))}:d=${num(windowSeconds)}:alpha=1`,
      );
    }
    if (text.animIn === "zoom" || text.animOut === "zoom") {
      const zoomIn = `0.9+0.1*min(t/${num(windowSeconds)},1)`;
      const zoomOut = `0.95+0.05*min(max(${num(clip.duration)}-t,0)/${num(windowSeconds)},1)`;
      const factor =
        text.animIn === "zoom" && text.animOut === "zoom"
          ? `min(${zoomIn},${zoomOut})`
          : text.animIn === "zoom"
            ? zoomIn
            : zoomOut;
      chain.push(`scale=w='iw*${factor}':h=-1:eval=frame`);
      chain.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0`);
    }
    chain.push(`setpts=PTS+${num(clip.start)}/TB`);
    filters.push(`[${inputIndex}:v]${chain.join(",")}[${label}]`);
    const next = `vtext${index}`;
    const slideY =
      text.animIn === "slide" || text.animOut === "slide"
        ? `if(lt(t,${num(clip.start + windowSeconds)}),${num(height * 0.1)}*(1-min(max(t-${num(clip.start)},0)/${num(windowSeconds)},1)),if(gt(t,${num(clipEnd(clip) - windowSeconds)}),${num(height * 0.08)}*(1-min(max(${num(clipEnd(clip))}-t,0)/${num(windowSeconds)},1)),0))`
        : null;
    filters.push(
      `[${videoLabel}][${label}]overlay=0:${slideY ? `'${slideY}'` : "0"}:enable='between(t,${num(clip.start)},${num(clipEnd(clip))})'${slideY ? ":eval=frame" : ""}[${next}]`,
    );
    videoLabel = next;
  }

  // --- Müzik / seslendirme izleri ---
  const musicLabels: string[] = [];
  const musicClips = audioTracks(project)
    .filter((track) => !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.kind === "audio" && clip.volume > 0.001)
    .sort((a, b) => a.start - b.start);

  for (let index = 0; index < musicClips.length; index += 1) {
    const clip = musicClips[index];
    const entry = resolveEntry(clip, entries);
    if (!entry) throw new Error(`Kaynak bulunamadı: ${clip.name}`);
    const source = sources.get(entry.id);
    if (!source) throw new Error(`Kaynak yazılamadı: ${clip.name}`);
    const inputIndex = addInput(["-i", source.name]);
    const span = Math.max(
      0.05,
      Math.min(
        clip.duration * clip.speed,
        Math.max(0.05, clip.sourceDuration - clip.inPoint),
      ),
    );
    const chain = [
      `atrim=start=${num(clip.inPoint)}:duration=${num(span)}`,
      "asetpts=PTS-STARTPTS",
    ];
    if (clip.reverse) chain.push("areverse", "asetpts=PTS-STARTPTS");
    const tempo = atempo(clip.speed);
    if (tempo) chain.push(tempo);
    chain.push(`volume=${num(clip.volume)}`);
    if (clip.fadeIn > 0.01) {
      chain.push(`afade=t=in:st=0:d=${num(Math.min(clip.fadeIn, clip.duration))}`);
    }
    if (clip.fadeOut > 0.01) {
      chain.push(
        `afade=t=out:st=${num(Math.max(0, clip.duration - clip.fadeOut))}:d=${num(clip.fadeOut)}`,
      );
    }
    chain.push(
      "aresample=44100",
      "aformat=sample_fmts=fltp:channel_layouts=stereo",
      `adelay=${Math.round(clip.start * 1000)}|${Math.round(clip.start * 1000)}`,
    );
    const label = `music${index}`;
    filters.push(`[${inputIndex}:a]${chain.join(",")}[${label}]`);
    musicLabels.push(label);
  }

  let audioLabel = "abase";
  if (musicLabels.length > 0) {
    filters.push(
      `[abase]${musicLabels.map((label) => `[${label}]`).join("")}amix=inputs=${
        musicLabels.length + 1
      }:duration=first:dropout_transition=0:normalize=0[aout]`,
    );
    audioLabel = "aout";
  }

  const output = "out.mp4";
  const args = [
    "-hide_banner",
    "-y",
    ...inputArgs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${videoLabel}]`,
    "-map",
    `[${audioLabel}]`,
    "-t",
    num(duration),
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    quality >= 1080 ? "22" : "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    output,
  ];

  try {
    const code = await execFFmpeg(ffmpeg, args, {
      signal,
      timeout: 30 * 60 * 1000,
      onProgress: (progress) => {
        onProgress?.(0.08 + Math.min(0.9, progress * 0.9));
      },
    });
    if (code !== 0) {
      throw new Error(`FFmpeg çıkış kodu ${code}.`);
    }
    if (signal?.aborted) throw new FFmpegCancelledError();
    const data = await ffmpeg.readFile(output);
    const bytes =
      data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data);
    const blob = new Blob([bytes], { type: "video/mp4" });
    onProgress?.(1);
    const safeName = project.name.replace(/[^\p{L}\p{N}_-]+/gu, "-") || "BeyTool";
    return {
      blob,
      fileName: `${safeName}-${quality}p.mp4`,
      mimeType: "video/mp4",
      size: blob.size,
    };
  } finally {
    if (!signal?.aborted) {
      for (const file of written) {
        try {
          await ffmpeg.deleteFile(file);
        } catch {
          /* dosya zaten silinmiş olabilir */
        }
      }
      try {
        await ffmpeg.deleteFile(output);
      } catch {
        /* yoksay */
      }
    }
  }
}

export function isCancelled(error: unknown): boolean {
  return isFFmpegCancelled(error);
}
