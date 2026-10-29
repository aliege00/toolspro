import { describe, expect, test } from "bun:test";
import {
  createProject,
  projectDuration,
} from "../../src/editor/core/model";
import type { Clip, Project } from "../../src/editor/core/model";
import { History, snapshotCommand } from "../../src/editor/core/history";
import {
  compactTrack,
  duplicateClip,
  moveClip,
  setClipFade,
  setClipReverse,
  setClipSpeed,
  splitClip,
  trimClip,
} from "../../src/editor/core/timeline";

function clip(id: string, start: number, duration: number, sourceDuration = 20, speed = 1): Clip {
  return {
    id,
    kind: "video",
    name: id,
    entryId: "e1",
    start,
    duration,
    inPoint: 0,
    sourceDuration,
    speed,
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
  };
}

function withClips(...clips: Clip[]): Project {
  const project = createProject("zaman");
  project.tracks[0].clips = clips;
  return project;
}

describe("zaman çizelgesi", () => {
  test("bölme sonrası sürelerin toplamı korunur", () => {
    const project = withClips(clip("a", 0, 6));
    const { project: next, rightId } = splitClip(project, "a", 2.5);
    expect(rightId).not.toBeNull();
    const clips = next.tracks[0].clips;
    expect(clips).toHaveLength(2);
    expect(clips[0].duration).toBeCloseTo(2.5, 5);
    expect(clips[1].duration).toBeCloseTo(3.5, 5);
    expect(clips[1].start).toBeCloseTo(2.5, 5);
    expect(projectDuration(next)).toBeCloseTo(6, 5);
  });

  test("bölme sınır dışındaysa proje değişmez", () => {
    const project = withClips(clip("a", 0, 4));
    const result = splitClip(project, "a", 0.01);
    expect(result.rightId).toBeNull();
    expect(result.project.tracks[0].clips).toHaveLength(1);
  });

  test("0.25x hız süreyi dört katına, 4x dörtte bire indirir", () => {
    const project = withClips(clip("a", 0, 10));
    const slow = setClipSpeed(project, "a", 0.25);
    expect(slow.tracks[0].clips[0].speed).toBe(0.25);
    expect(slow.tracks[0].clips[0].duration).toBeCloseTo(40, 5);

    const fast = setClipSpeed(project, "a", 4);
    expect(fast.tracks[0].clips[0].speed).toBe(4);
    expect(fast.tracks[0].clips[0].duration).toBeCloseTo(2.5, 5);
  });

  test("hız sınırları 0.25–4 aralığında tutulur", () => {
    const project = withClips(clip("a", 0, 4));
    expect(setClipSpeed(project, "a", 0.01).tracks[0].clips[0].speed).toBe(0.25);
    expect(setClipSpeed(project, "a", 99).tracks[0].clips[0].speed).toBe(4);
  });

  test("ters çevirme açılıp kapatılabilir", () => {
    const project = withClips(clip("a", 0, 4));
    const reversed = setClipReverse(project, "a", true);
    expect(reversed.tracks[0].clips[0].reverse).toBe(true);
    expect(setClipReverse(reversed, "a", false).tracks[0].clips[0].reverse).toBe(false);
  });

  test("taşıma aynı izde çakışma bırakmaz", () => {
    const project = withClips(clip("a", 0, 3), clip("b", 5, 2), clip("c", 9, 2));
    const moved = moveClip(project, "c", 1);
    const clips = [...moved.tracks[0].clips].sort((x, y) => x.start - y.start);
    for (let i = 1; i < clips.length; i += 1) {
      expect(clips[i].start).toBeGreaterThanOrEqual(clips[i - 1].start + clips[i - 1].duration - 1e-6);
    }
  });

  test("çoğaltma özgün klibin sağına boşluğa yerleşir", () => {
    const project = withClips(clip("a", 0, 3), clip("b", 4, 2));
    const { project: next, clipId } = duplicateClip(project, "a");
    expect(clipId).not.toBeNull();
    const copy = next.tracks[0].clips.find((item) => item.id === clipId)!;
    expect(copy.start).toBeCloseTo(6, 5);
  });

  test("sol kenar kırpma kaynak başlangıcını kaydırır", () => {
    const project = withClips(clip("a", 2, 5));
    const trimmed = trimClip(project, "a", "left", 1);
    const result = trimmed.tracks[0].clips[0];
    expect(result.start).toBeCloseTo(3, 5);
    expect(result.duration).toBeCloseTo(4, 5);
    expect(result.inPoint).toBeCloseTo(1, 5);
  });

  test("sağ kenar kırpma sonraki klibi aşmaz", () => {
    const project = withClips(clip("a", 0, 3), clip("b", 4, 2));
    const trimmed = trimClip(project, "a", "right", 5);
    expect(trimmed.tracks[0].clips[0].duration).toBeCloseTo(4, 5);
  });

  test("fade süresi klip süresinin yarısıyla sınırlı", () => {
    const project = withClips(clip("a", 0, 2));
    const faded = setClipFade(project, "a", "in", 99);
    expect(faded.tracks[0].clips[0].fadeIn).toBeCloseTo(1, 5);
  });

  test("compactTrack boşlukları kaldırır", () => {
    const project = withClips(clip("a", 1, 2), clip("b", 6, 2));
    const compact = compactTrack(project, project.tracks[0].id);
    expect(compact.tracks[0].clips[0].start).toBe(0);
    expect(compact.tracks[0].clips[1].start).toBe(2);
  });

  test("her zaman çizelgesi işlemi geri alınınca proje birebir aynı olur", () => {
    const start = withClips(clip("a", 0, 3), clip("b", 5, 2));
    const operations: ((project: Project) => Project)[] = [
      (project) => splitClip(project, "a", 1.5).project,
      (project) => trimClip(project, "a", "left", 0.5),
      (project) => trimClip(project, "a", "right", -0.5),
      (project) => setClipSpeed(project, "a", 2),
      (project) => setClipReverse(project, "a", true),
      (project) => setClipFade(project, "a", "in", 0.5),
      (project) => moveClip(project, "b", 1),
      (project) => duplicateClip(project, "a").project,
      (project) => compactTrack(project, project.tracks[0].id),
    ];
    for (const operation of operations) {
      const after = operation(start);
      const history = new History<Project>(start);
      history.execute(snapshotCommand(start, after));
      expect(history.undo()).toEqual(start);
    }
  });
});
