import { describe, expect, test } from "bun:test";
import {
  CURRENT_SCHEMA,
  ProjectParseError,
  baseClip,
  createProject,
  migrateProject,
  projectDuration,
} from "../../src/editor/core/model";
import type { Clip, Project } from "../../src/editor/core/model";

function clip(overrides: Partial<Clip> = {}): Clip {
  const base = baseClip("video", 0, 2);
  return {
    ...base,
    sourceDuration: 10,
    ...overrides,
  };
}

function project(clips: Clip[], aspect: Project["aspect"] = "9:16"): Project {
  const created = createProject("test");
  created.aspect = aspect;
  created.tracks[0].clips = clips;
  return created;
}

describe("proje modeli", () => {
  test("boş proje sıfır süre ve güncel şema üretir", () => {
    const created = createProject("  ");
    expect(created.schema).toBe(CURRENT_SCHEMA);
    expect(created.name).toBe("Yeni proje");
    expect(projectDuration(created)).toBe(0);
    expect(created.tracks.map((track) => track.kind)).toEqual(["video", "audio", "text"]);
  });

  test("tek klip ve boşluklu kliplerin süresi doğru", () => {
    expect(projectDuration(project([clip({ duration: 3 })]))).toBe(3);
    expect(
      projectDuration(project([clip({ start: 2, duration: 2 }), clip({ start: 7, duration: 1 })])),
    ).toBe(8);
  });

  test("bozuk JSON uygulamayı çökertmeden anlamlı hata verir", () => {
    expect(() => migrateProject("{bozuk")).toThrow(ProjectParseError);
    expect(() => migrateProject(null)).toThrow(ProjectParseError);
    expect(() => migrateProject({ tracks: "yok" })).not.toThrow();
  });

  test("şema 1 girdisi şema 2'ye taşınır ve eksik alanlar doldurulur", () => {
    const legacy = {
      schema: 1,
      id: "old",
      name: "Eski proje",
      createdAt: 1,
      updatedAt: 2,
      aspect: "16:9",
      tracks: [
        {
          id: "t1",
          kind: "video",
          name: "Video",
          clips: [
            {
              id: "c1",
              kind: "video",
              name: "klip",
              start: 1,
              duration: 2,
              speed: 2,
            },
          ],
        },
      ],
    };
    const migrated = migrateProject(legacy);
    expect(migrated.from).toBe(1);
    expect(migrated.project.schema).toBe(2);
    expect(migrated.project.fps).toBe(30);
    expect(migrated.project.tracks[0].clips[0].filter.preset).toBe("none");
    expect(migrated.project.tracks[0].clips[0].speed).toBe(2);
    expect(migrated.project.tracks[0].clips[0].volume).toBe(1);
  });

  test("düz klip listesi video izine taşınır", () => {
    const migrated = migrateProject({
      clips: [{ kind: "video", duration: 4, name: "düz" }],
    });
    expect(migrated.from).toBe(0);
    expect(migrated.project.tracks[0].kind).toBe("video");
    expect(migrated.project.tracks[0].clips[0].name).toBe("düz");
    expect(migrated.warnings.some((warning) => warning.includes("video izine"))).toBe(true);
  });

  test("geçersiz hız ve süreler güvenli aralığa çekilir", () => {
    const migrated = migrateProject({
      schema: 2,
      tracks: [
        {
          kind: "video",
          clips: [{ kind: "video", duration: -4, speed: 99, volume: 5 }],
        },
      ],
    });
    const migratedClip = migrated.project.tracks[0].clips[0];
    expect(migratedClip.duration).toBeGreaterThan(0);
    expect(migratedClip.speed).toBe(4);
    expect(migratedClip.volume).toBe(2);
  });
});
