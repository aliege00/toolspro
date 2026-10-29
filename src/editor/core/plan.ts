/**
 * Proje modelinden FFmpeg dışa aktarma planı üretir.
 * Saf TypeScript: FFmpeg çalıştırmaz, dosya okumaz. Testler bu planın
 * filtre metnini ve komut argümanlarını doğrular.
 */
import {
  FPS,
  aspectSize,
  audioTracks,
  clamp,
  clipEnd,
  mainVideoTrack,
  projectDuration,
  sortedClips,
  textTracks,
} from "./model";
import type {
  AspectId,
  Clip,
  ExportQuality,
  Project,
  TextAlign,
  TextAnim,
} from "./model";

export type ExportPreset = {
  quality: ExportQuality;
  aspect?: AspectId;
  fps?: number;
  /** Bu sayıdan fazla klipte parçalı dışa aktarma önerilir. */
  segmentedAboveClips?: number;
  segmentedAboveSeconds?: number;
};

export type PlanSource = {
  id: string;
  fileName: string;
  hasAudio: boolean;
};

export type TextOverlay = {
  clipId: string;
  start: number;
  duration: number;
  content: string;
  font: string;
  color: string;
  align: TextAlign;
  animIn: TextAnim;
  animOut: TextAnim;
};

export type PlannedSegment = {
  kind: "clip" | "gap";
  clipId?: string;
  label: string;
  start: number;
  duration: number;
  inputArgs: string[];
  videoChain: string | null;
  audioChain: string | null;
  videoLabel: string;
  audioLabel: string;
  missingSource?: boolean;
};

export type ExportPlan = {
  width: number;
  height: number;
  fps: number;
  duration: number;
  quality: ExportQuality;
  mode: "single" | "segmented";
  segments: PlannedSegment[];
  textOverlays: TextOverlay[];
  warnings: string[];
  filterComplex: string;
  args: string[];
  segmentCommands: { args: string[]; output: string }[];
  concatList: string;
  concatArgs: string[];
};

function num(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}

/** atempo 0.5–2 aralığında çalışır; dışındaki hızlar zincirlenir. */
export function atempo(speed: number): string {
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

function sourceFor(clip: Clip, sources: Map<string, PlanSource>): PlanSource | undefined {
  return (
    (clip.entryId ? sources.get(clip.entryId) : undefined) ??
    (clip.entryKey ? sources.get(clip.entryKey) : undefined)
  );
}

function spanFor(clip: Clip): number {
  if (clip.kind === "image") return clip.duration;
  return Math.max(
    0.05,
    Math.min(
      clip.duration * clip.speed,
      Math.max(0.05, clip.sourceDuration - clip.inPoint),
    ),
  );
}

function videoChain(clip: Clip, width: number, height: number, fps: number): string {
  const chain: string[] = [];
  const isImage = clip.kind === "image";
  const frozen = clip.kind === "video" && clip.freezeAt !== undefined;

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
      `trim=start=${num(clip.inPoint)}:duration=${num(spanFor(clip))}`,
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
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
  );

  if (isImage && clip.kenBurns) {
    const frames = Math.max(1, Math.round(fps * clip.duration));
    chain.push(
      `zoompan=z='min(1.1,1+0.10*on/${frames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps}`,
    );
  }

  const eq: string[] = [];
  if (Math.abs(clip.filter.brightness) > 0.01) {
    eq.push(`brightness=${num(clip.filter.brightness / 100)}`);
  }
  if (Math.abs(clip.filter.contrast) > 0.01) {
    eq.push(`contrast=${num(1 + clip.filter.contrast / 100)}`);
  }
  if (Math.abs(clip.filter.saturation) > 0.01) {
    eq.push(`saturation=${num(1 + clip.filter.saturation / 100)}`);
  }
  if (eq.length > 0) chain.push(`eq=${eq.join(":")}`);
  if (clip.filter.preset === "bw") chain.push("hue=s=0");
  if (clip.filter.preset === "sepia") {
    chain.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131");
  }
  if (clip.filter.preset === "vignette") chain.push("vignette=PI/4");

  chain.push("setsar=1", `fps=${fps}`, "format=yuv420p");

  const fadeIn = clamp(clip.fadeIn, 0, clip.duration / 2);
  const fadeOut = clamp(clip.fadeOut, 0, clip.duration / 2);
  if (fadeIn > 0.01) chain.push(`fade=t=in:st=0:d=${num(fadeIn)}`);
  if (fadeOut > 0.01) {
    chain.push(`fade=t=out:st=${num(Math.max(0, clip.duration - fadeOut))}:d=${num(fadeOut)}`);
  }
  if (clip.transitionIn === "fade") {
    chain.push(`fade=t=in:st=0:d=${num(clamp(clip.transitionDuration, 0.1, clip.duration / 2))}`);
  }
  if (clip.transitionIn === "flash") {
    chain.push(
      `fade=t=in:st=0:d=${num(clamp(clip.transitionDuration, 0.1, clip.duration / 2))}:color=white`,
    );
  }
  if (clip.transitionIn === "zoom") {
    const frames = Math.max(1, Math.round(fps * clamp(clip.transitionDuration, 0.1, 2)));
    chain.push(
      `zoompan=z='max(1,1.12-0.12*min(on/${frames},1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps}`,
      "setsar=1",
    );
  }
  return chain.join(",");
}

function audioChain(clip: Clip): string | null {
  if (clip.kind !== "video" && clip.kind !== "audio") return null;
  if (clip.volume <= 0.001) return null;
  const chain = [
    `atrim=start=${num(clip.inPoint)}:duration=${num(spanFor(clip))}`,
    "asetpts=PTS-STARTPTS",
  ];
  if (clip.reverse) chain.push("areverse", "asetpts=PTS-STARTPTS");
  const tempo = atempo(clip.speed);
  if (tempo) chain.push(tempo);
  chain.push(`volume=${num(clip.volume)}`);
  const fadeIn = clamp(clip.fadeIn, 0, clip.duration / 2);
  const fadeOut = clamp(clip.fadeOut, 0, clip.duration / 2);
  if (fadeIn > 0.01) chain.push(`afade=t=in:st=0:d=${num(fadeIn)}`);
  if (fadeOut > 0.01) {
    chain.push(`afade=t=out:st=${num(Math.max(0, clip.duration - fadeOut))}:d=${num(fadeOut)}`);
  }
  chain.push("aresample=44100", "aformat=sample_fmts=fltp:channel_layouts=stereo");
  return chain.join(",");
}

function gapSegment(index: number, start: number, duration: number, width: number, height: number, fps: number): PlannedSegment {
  const videoLabel = `v${index}`;
  const audioLabel = `a${index}`;
  return {
    kind: "gap",
    label: `boşluk-${index}`,
    start,
    duration,
    inputArgs: [],
    videoChain: `color=c=black:s=${width}x${height}:r=${fps}:d=${num(duration)},format=yuv420p[${videoLabel}]`,
    audioChain: `anullsrc=r=44100:cl=stereo,atrim=duration=${num(duration)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[${audioLabel}]`,
    videoLabel,
    audioLabel,
  };
}

function clipSegment(clip: Clip, index: number, width: number, height: number, fps: number, sources: Map<string, PlanSource>): PlannedSegment {
  const source = sourceFor(clip, sources);
  const isImage = clip.kind === "image";
  const missing = !source;
  const inputArgs = missing || isImage
    ? []
    : ["-i", source!.fileName];
  const videoLabel = `v${index}`;
  const audioLabel = `a${index}`;

  if (missing) {
    return {
      kind: "gap",
      clipId: clip.id,
      label: clip.name,
      start: clip.start,
      duration: clip.duration,
      inputArgs: [],
      videoChain: `color=c=black:s=${width}x${height}:r=${fps}:d=${num(clip.duration)},format=yuv420p[${videoLabel}]`,
      audioChain: `anullsrc=r=44100:cl=stereo,atrim=duration=${num(clip.duration)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[${audioLabel}]`,
      videoLabel,
      audioLabel,
      missingSource: true,
    };
  }

  const input = isImage
    ? ["-loop", "1", "-t", num(clip.duration + 0.2), "-i", source!.fileName]
    : inputArgs;
  const chain = videoChain(clip, width, height, fps);
  const audio = source!.hasAudio ? audioChain(clip) : null;
  return {
    kind: "clip",
    clipId: clip.id,
    label: clip.name,
    start: clip.start,
    duration: clip.duration,
    inputArgs: input,
    // Gap segmentlerinde zincir etiketi içerir; klip segmentinde ayrı eklenir.
    videoChain: chain,
    audioChain: audio,
    videoLabel,
    audioLabel,
  };
}

function outputArgs(quality: ExportQuality, fps: number, duration: number, output: string): string[] {
  return [
    "-t",
    num(duration),
    "-r",
    num(fps),
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
}

/**
 * Projeden tek komutluk veya parçalı dışa aktarma planı üretir.
 * Kaynağı bulunamayan klipler siyah/sessiz segment olur ve uyarı eklenir.
 */
export function buildExportPlan(
  project: Project,
  preset: ExportPreset,
  sources: PlanSource[],
): ExportPlan {
  const duration = projectDuration(project);
  if (duration <= 0.05) throw new Error("Zaman çizelgesi boş.");

  const width = preset.aspect ? aspectSize(preset.aspect, preset.quality).width : aspectSize(project.aspect, preset.quality).width;
  const height = preset.aspect ? aspectSize(preset.aspect, preset.quality).height : aspectSize(project.aspect, preset.quality).height;
  const fps = clamp(preset.fps ?? project.fps ?? FPS, 1, 60);
  const sourceMap = new Map<string, PlanSource>();
  for (const source of sources) sourceMap.set(source.id, source);

  const warnings: string[] = [];
  const main = mainVideoTrack(project);
  const clips = main
    ? sortedClips(main).filter((clip) => clip.kind === "video" || clip.kind === "image")
    : [];

  const segments: PlannedSegment[] = [];
  let cursor = 0;
  for (const clip of clips) {
    if (clip.start > cursor + 0.01) {
      segments.push(gapSegment(segments.length, cursor, clip.start - cursor, width, height, fps));
    }
    const segment = clipSegment(clip, segments.length, width, height, fps, sourceMap);
    if (segment.missingSource) warnings.push(`Kaynak bulunamadı: ${clip.name}`);
    if (segment.kind === "clip" && !segment.audioChain) {
      warnings.push(`Sessiz kaynak (ses yok): ${clip.name}`);
    }
    segments.push(segment);
    cursor = Math.max(cursor, clipEnd(clip));
  }
  if (duration > cursor + 0.01) {
    segments.push(gapSegment(segments.length, cursor, duration - cursor, width, height, fps));
  }
  if (segments.length === 0) {
    segments.push(gapSegment(0, 0, duration, width, height, fps));
  }

  // Tek komut için girişleri ve filtreleri sırayla kur.
  const inputs: string[] = [];
  const filterParts: string[] = [];
  let inputCursor = 0;
  segments.forEach((segment) => {
    if (segment.kind === "gap" || segment.missingSource) {
      filterParts.push(segment.videoChain!);
      filterParts.push(segment.audioChain!);
      return;
    }
    const sourceIndex = inputCursor;
    inputs.push(...segment.inputArgs);
    inputCursor += 1;
    filterParts.push(`[${sourceIndex}:v]${segment.videoChain}[${segment.videoLabel}]`);
    if (segment.audioChain) {
      filterParts.push(`[${sourceIndex}:a]${segment.audioChain}[${segment.audioLabel}]`);
    } else {
      filterParts.push(
        `anullsrc=r=44100:cl=stereo,atrim=duration=${num(segment.duration)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[${segment.audioLabel}]`,
      );
    }
  });

  const concatLabels = segments
    .map((segment) => `[${segment.videoLabel}][${segment.audioLabel}]`)
    .join("");
  filterParts.push(
    `${concatLabels}concat=n=${segments.length}:v=1:a=1[vbase][abase]`,
  );

  // Müzik / seslendirme izleri.
  const music = audioTracks(project)
    .filter((track) => !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.kind === "audio" && clip.volume > 0.001)
    .sort((a, b) => a.start - b.start);
  const musicLabels: string[] = [];
  for (const clip of music) {
    const source = sourceFor(clip, sourceMap);
    if (!source) {
      warnings.push(`Müzik kaynağı bulunamadı: ${clip.name}`);
      continue;
    }
    const index = inputCursor;
    inputs.push("-i", source.fileName);
    inputCursor += 1;
    const chain = audioChain(clip);
    if (!chain) continue;
    const label = `music${musicLabels.length}`;
    filterParts.push(
      `[${index}:a]${chain},adelay=${Math.round(clip.start * 1000)}|${Math.round(clip.start * 1000)}[${label}]`,
    );
    musicLabels.push(label);
  }
  let audioLabel = "abase";
  if (musicLabels.length > 0) {
    filterParts.push(
      `[abase]${musicLabels.map((label) => `[${label}]`).join("")}amix=inputs=${musicLabels.length + 1}:duration=first:dropout_transition=0:normalize=0[aout]`,
    );
    audioLabel = "aout";
  }
  filterParts.push("[vbase]null[vout]");

  const filterComplex = filterParts.join(";");
  const textOverlays: TextOverlay[] = textTracks(project)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.kind === "text" && !!clip.text?.content.trim())
    .map((clip) => ({
      clipId: clip.id,
      start: clip.start,
      duration: clip.duration,
      content: clip.text!.content,
      font: clip.text!.font,
      color: clip.text!.color,
      align: clip.text!.align,
      animIn: clip.text!.animIn,
      animOut: clip.text!.animOut,
    }));
  if (textOverlays.length > 0) {
    warnings.push("Metin katmanları dışa aktarmada PNG olarak bindirilir.");
  }

  const mode =
    clips.length >= (preset.segmentedAboveClips ?? 12) ||
    duration >= (preset.segmentedAboveSeconds ?? 240)
      ? "segmented"
      : "single";

  const args = [
    "-hide_banner",
    "-y",
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-map",
    `[${audioLabel}]`,
    ...outputArgs(preset.quality, fps, duration, "out.mp4"),
  ];

  const segmentCommands = segments.map((segment, index) => {
    const output = `seg_${String(index).padStart(3, "0")}.mp4`;
    const isGap = segment.kind === "gap" || segment.missingSource;
    const segmentInputs = isGap ? [] : [...segment.inputArgs];
    const videoFilters = isGap
      ? `color=c=black:s=${width}x${height}:r=${fps}:d=${num(segment.duration)},format=yuv420p[v]`
      : `[0:v]${segment.videoChain},setsar=1,fps=${fps},format=yuv420p[v]`;
    const audioFilters = isGap || !segment.audioChain
      ? `anullsrc=r=44100:cl=stereo,atrim=duration=${num(segment.duration)},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:channel_layouts=stereo[a]`
      : `[0:a]${segment.audioChain}[a]`;
    const filter = `${videoFilters};${audioFilters}`;
    return {
      args: [
        "-hide_banner",
        "-y",
        ...segmentInputs,
        "-filter_complex",
        filter,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-t",
        num(segment.duration),
        "-r",
        num(fps),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        preset.quality >= 1080 ? "22" : "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        output,
      ],
      output,
    };
  });

  const concatList = segmentCommands
    .map((command) => `file '${command.output}'`)
    .join("\n");
  const concatArgs = [
    "-hide_banner",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "segments.txt",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "out.mp4",
  ];

  return {
    width,
    height,
    fps,
    duration,
    quality: preset.quality,
    mode,
    segments,
    textOverlays,
    warnings: [...new Set(warnings)],
    filterComplex,
    args,
    segmentCommands,
    concatList,
    concatArgs,
  };
}
