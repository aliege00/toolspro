export type Cue = {
  start: number;
  end: number;
  text: string;
};

const TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

export function parseSrt(input: string): { cues: Cue[]; skipped: number } {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues: Cue[] = [];
  let skipped = 0;

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;
    const arrow = lines.findIndex((line) => line.includes("-->"));
    if (arrow === -1) {
      skipped += 1;
      continue;
    }
    const match = lines[arrow].match(new RegExp(`${TIME.source}\\s*-->\\s*${TIME.source}`));
    if (!match) {
      skipped += 1;
      continue;
    }
    const start = toSeconds(match[1], match[2], match[3], match[4]);
    const end = toSeconds(match[5], match[6], match[7], match[8]);
    const text = lines.slice(arrow + 1).join("\n").trim();
    if (!text || end <= start) {
      skipped += 1;
      continue;
    }
    cues.push({ start, end, text });
  }

  cues.sort((a, b) => a.start - b.start);
  return { cues, skipped };
}

function toSeconds(h: string, m: string, s: string, ms: string): number {
  return (
    Number(h) * 3600 +
    Number(m) * 60 +
    Number(s) +
    Number(ms.padEnd(3, "0").slice(0, 3)) / 1000
  );
}

export function formatSrtTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function formatSrt(cues: Cue[]): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}`,
    )
    .join("\n\n")
    .concat("\n");
}

/** Zamanları kaydırır; negatife düşen başlangıçlar sıfıra çekilir. */
export function shiftCues(cues: Cue[], deltaSeconds: number): Cue[] {
  return cues.map((cue) => {
    const start = Math.max(0, cue.start + deltaSeconds);
    const end = Math.max(0, cue.end + deltaSeconds);
    return { ...cue, start, end: Math.max(start + 0.2, end) };
  });
}

export function cueText(cue: Cue): string {
  return cue.text.replace(/\n/g, " ");
}
