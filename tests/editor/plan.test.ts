import { describe, expect, test } from "bun:test";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../../src/editor/core/model";
import type { Clip, Project } from "../../src/editor/core/model";
import { atempo, buildExportPlan } from "../../src/editor/core/plan";
import type { PlanSource } from "../../src/editor/core/plan";

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    kind: "video",
    name: "klip",
    entryId: "e1",
    start: 0,
    duration: 2,
    inPoint: 0,
    sourceDuration: 10,
    speed: 1,
    reverse: false,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    rotate: 0,
    flipH: false,
    flipV: false,
    filter: { brightness: 0, contrast: 0, saturation: 0, preset: "none" },
    transitionIn: "none",
    transitionDuration: 0.4,
    ...overrides,
  };
}

function projectWith(clips: Clip[], aspect: Project["aspect"] = "9:16"): Project {
  const project = createProject("plan");
  project.aspect = aspect;
  project.tracks[0].clips = clips;
  return project;
}

function source(overrides: Partial<PlanSource> = {}): PlanSource {
  return { id: "e1", fileName: "src.mp4", hasAudio: true, ...overrides };
}

function labelsBalanced(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

describe("buildExportPlan", () => {
  test("boş proje net hata verir", () => {
    expect(() => buildExportPlan(createProject("boş"), { quality: 720 }, [])).toThrow(
      "Zaman çizelgesi boş.",
    );
  });

  test("tek klip için geçerli filtre metni ve komut üretir", () => {
    const plan = buildExportPlan(projectWith([clip()]), { quality: 720 }, [source()]);
    expect(plan.mode).toBe("single");
    expect(plan.width).toBe(720);
    expect(plan.height).toBe(1280);
    expect(plan.filterComplex).toContain("concat=n=1");
    for (const token of ["-c:v", "libx264"]) expect(plan.args).toContain(token);
    expect(labelsBalanced(plan.filterComplex)).toBe(true);
    expect(plan.filterComplex).toContain("[vout]");
    expect(plan.filterComplex).toContain("[abase]");
    expect(plan.args).toContain("[abase]");
    expect(plan.args.at(-1)).toBe("out.mp4");
  });

  test("boşluklar siyah video ve sessizlik segmenti olur", () => {
    const plan = buildExportPlan(
      projectWith([clip({ start: 1, duration: 2 })]),
      { quality: 480 },
      [source()],
    );
    expect(plan.segments).toHaveLength(2);
    expect(plan.segments[0].kind).toBe("gap");
    expect(plan.segments[0].videoChain).toContain("color=c=black");
    expect(plan.segments[0].audioChain).toContain("anullsrc");
    expect(plan.duration).toBe(3);
  });

  test("sessiz kaynak uyarı verir ve anullsrc kullanır", () => {
    const plan = buildExportPlan(projectWith([clip()]), { quality: 480 }, [
      source({ hasAudio: false }),
    ]);
    expect(plan.warnings.some((warning) => warning.includes("Sessiz"))).toBe(true);
    expect(plan.filterComplex).toContain("anullsrc");
  });

  test("eksik kaynak çökmez, siyah segment ve uyarı üretir", () => {
    const plan = buildExportPlan(projectWith([clip()]), { quality: 480 }, []);
    expect(plan.warnings.some((warning) => warning.includes("Kaynak bulunamadı"))).toBe(true);
    expect(plan.segments[0].missingSource).toBe(true);
    expect(plan.filterComplex).toContain("color=c=black");
  });

  test("hız 0.25 ve 4 için setpts/atempo zinciri üretir", () => {
    const slow = buildExportPlan(
      projectWith([clip({ speed: 0.25, duration: 8 })]),
      { quality: 480 },
      [source()],
    );
    expect(slow.filterComplex).toContain("setpts=PTS/0.25");
    expect(slow.filterComplex).toContain("atempo=0.5");

    const fast = buildExportPlan(
      projectWith([clip({ speed: 4, duration: 2 })]),
      { quality: 480 },
      [source()],
    );
    expect(fast.filterComplex).toContain("setpts=PTS/4");
    expect(fast.filterComplex).toContain("atempo=2");
    expect(atempo(0.25)).toBe("atempo=0.5,atempo=0.5");
    expect(atempo(0.2)).toBe("atempo=0.5,atempo=0.5,atempo=0.8");
    expect(atempo(8)).toBe("atempo=2,atempo=2,atempo=2");
  });

  test("ters çevirme hem video hem ses zincirine girer", () => {
    const plan = buildExportPlan(projectWith([clip({ reverse: true })]), { quality: 480 }, [
      source(),
    ]);
    expect(plan.filterComplex).toContain("reverse");
    expect(plan.filterComplex).toContain("areverse");
  });

  test("döndürme, yansıtma ve filtreler zincire eklenir", () => {
    const plan = buildExportPlan(
      projectWith([
        clip({
          rotate: 90,
          flipH: true,
          flipV: true,
          filter: { brightness: 10, contrast: 20, saturation: -30, preset: "sepia" },
        }),
      ]),
      { quality: 480 },
      [source()],
    );
    for (const token of ["transpose=1", "hflip", "vflip", "eq=", "colorchannelmixer"]) {
      expect(plan.filterComplex).toContain(token);
    }
  });

  test("en-boy oranları hedef boyutu değiştirir", () => {
    const cases: [Project["aspect"], number, number][] = [
      ["9:16", 720, 1280],
      ["16:9", 1280, 720],
      ["1:1", 720, 720],
      ["4:5", 720, 900],
    ];
    for (const [aspect, width, height] of cases) {
      const plan = buildExportPlan(projectWith([clip()], aspect), { quality: 720 }, [source()]);
      expect([plan.width, plan.height]).toEqual([width, height]);
    }
  });

  test("büyük proje parçalı moda geçer ve segment komutları üretir", () => {
    const clips = Array.from({ length: 13 }, (_, index) =>
      clip({ id: `c${index}`, start: index * 2, duration: 2 }),
    );
    const plan = buildExportPlan(projectWith(clips), { quality: 480 }, [source()]);
    expect(plan.mode).toBe("segmented");
    expect(plan.segmentCommands.length).toBe(13);
    expect(plan.concatList).toContain("seg_000.mp4");
    expect(plan.concatArgs).toContain("concat");
  });

  test("metin katmanları plana ayrı overlay olarak eklenir", () => {
    const project = projectWith([clip()]);
    project.tracks.find((track) => track.kind === "text")!.clips.push({
      ...clip({ id: "t1", kind: "text", name: "Metin", volume: 0 }),
      text: {
        content: "Merhaba",
        font: "system",
        size: 42,
        color: "#fff",
        align: "center",
        animIn: "fade",
        animOut: "fade",
      },
    });
    const plan = buildExportPlan(project, { quality: 480 }, [source()]);
    expect(plan.textOverlays).toHaveLength(1);
    expect(plan.textOverlays[0].content).toBe("Merhaba");
    expect(plan.warnings.some((warning) => warning.includes("Metin"))).toBe(true);
  });

  test("üretilen komut gerçek FFmpeg ile sentetik videoda çalışır", () => {
    const ffmpeg = Bun.which("ffmpeg");
    if (!ffmpeg) {
      console.warn("ffmpeg bulunamadı; gerçek çalıştırma testi atlandı.");
      return;
    }
    const dir = mkdtempSync(join(tmpdir(), "beytool-plan-"));
    const sourcePath = join(dir, "src.mp4");
    const generated = Bun.spawnSync(
      [
        ffmpeg,
        "-hide_banner",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=320x240:rate=30:duration=3",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=3",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        sourcePath,
      ],
      { cwd: dir },
    );
    expect(generated.exitCode).toBe(0);

    const plan = buildExportPlan(
      projectWith([clip({ duration: 2, sourceDuration: 3 })]),
      { quality: 480, aspect: "16:9" },
      [source({ fileName: "src.mp4" })],
    );
    const run = Bun.spawnSync([ffmpeg, ...plan.args], { cwd: dir });
    if (run.exitCode !== 0) console.error(new TextDecoder().decode(run.stderr));
    expect(run.exitCode).toBe(0);
    expect(existsSync(join(dir, "out.mp4"))).toBe(true);

    const probe = Bun.spawnSync(
      [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        join(dir, "out.mp4"),
      ],
      { cwd: dir },
    );
    const seconds = Number(new TextDecoder().decode(probe.stdout).trim());
    expect(seconds).toBeGreaterThan(1.5);
    expect(seconds).toBeLessThan(2.7);
  });
});
