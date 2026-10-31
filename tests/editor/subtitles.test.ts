import { describe, expect, test } from "bun:test";
import { subtitleClips } from "../../src/editor/core/subtitles";
import type { Cue } from "../../src/lib/srt";

function cue(start: number, end: number, text: string): Cue {
  return { start, end, text };
}

describe("altyazı klipleri", () => {
  test("her geçerli cue için alt hizalı metin klibi üretilir", () => {
    const clips = subtitleClips([
      cue(0, 1.5, "Merhaba"),
      cue(2, 3.4, "Dünya"),
    ]);
    expect(clips).toHaveLength(2);
    expect(clips[0].kind).toBe("text");
    expect(clips[0].text?.content).toBe("Merhaba");
    expect(clips[0].text?.vAlign).toBe("bottom");
    expect(clips[0].text?.animIn).toBe("none");
    expect(clips[0].start).toBeCloseTo(0, 5);
    expect(clips[0].duration).toBeCloseTo(1.5, 5);
    expect(clips[1].start).toBeCloseTo(2, 5);
  });

  test("boş veya bozuk cue'lar atlanır", () => {
    const clips = subtitleClips([
      cue(0, 1, "   "),
      cue(-2, 1, "negatif"),
      cue(4, 2, "ters"),
      cue(5, 6, "geçerli"),
    ]);
    expect(clips).toHaveLength(1);
    expect(clips[0].text?.content).toBe("geçerli");
  });

  test("çakışan klipler kısaltılır; asla üst üste binmez", () => {
    const clips = subtitleClips([
      cue(0, 4, "uzun altyazı"),
      cue(2, 3, "çakışan"),
    ]);
    expect(clips).toHaveLength(2);
    expect(clips[1].start).toBeGreaterThanOrEqual(
      clips[0].start + clips[0].duration - 1e-6,
    );
  });

  test("çok kısa cue'lar okunabilir minimum süreye yuvarlanır", () => {
    const clips = subtitleClips([cue(0, 0.1, "kısa")], { minDuration: 0.6 });
    expect(clips[0].duration).toBeCloseTo(0.6, 5);
  });

  test("çok uzun cue'lar üst sınırla kesilir", () => {
    const clips = subtitleClips([cue(0, 600, "uzun")], { maxDuration: 10 });
    expect(clips[0].duration).toBeCloseTo(10, 5);
  });

  test("offset tüm klipleri zaman çizelgesinde kaydırır", () => {
    const clips = subtitleClips([cue(1, 2, "test")], { offset: 10 });
    expect(clips[0].start).toBeCloseTo(11, 5);
  });

  test("aynı ize eklendiğinde çakışma kalmaz", () => {
    const clips = subtitleClips([
      cue(0, 3, "bir"),
      cue(1, 2, "iki"),
    ]);
    for (let i = 1; i < clips.length; i += 1) {
      expect(clips[i].start).toBeGreaterThanOrEqual(
        clips[i - 1].start + clips[i - 1].duration - 1e-6,
      );
    }
  });
});
