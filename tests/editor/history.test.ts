import { describe, expect, test } from "bun:test";
import { History, snapshotCommand } from "../../src/editor/core/history";
import { createProject, projectDuration } from "../../src/editor/core/model";
import type { Project } from "../../src/editor/core/model";

function projectWithDuration(duration: number): Project {
  const project = createProject("geçmiş");
  project.tracks[0].clips.push({
    id: `c-${duration}`,
    kind: "video",
    name: "klip",
    start: 0,
    duration,
    inPoint: 0,
    sourceDuration: 30,
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
  });
  return project;
}

describe("geri al / yinele", () => {
  test("bir işlemin tersi başlangıç projesini birebir üretir", () => {
    const start = projectWithDuration(2);
    const after = projectWithDuration(3);
    const history = new History<Project>(start);
    history.execute(snapshotCommand(start, after, "süre"));
    expect(projectDuration(history.current)).toBe(3);
    expect(history.canUndo).toBe(true);
    expect(history.undo()).toEqual(start);
    expect(history.canRedo).toBe(true);
    expect(history.redo()).toEqual(after);
  });

  test("üç adımlı zincir geri alınıp yinelemede aynı sonuca ulaşır", () => {
    const states = [1, 2, 3, 4].map(projectWithDuration);
    const history = new History<Project>(states[0]);
    for (let i = 1; i < states.length; i += 1) {
      history.execute(snapshotCommand(states[i - 1], states[i]));
    }
    expect(history.depth).toBe(3);
    expect(history.undo()).toEqual(states[2]);
    expect(history.undo()).toEqual(states[1]);
    expect(history.undo()).toEqual(states[0]);
    expect(history.canUndo).toBe(false);
    expect(history.redo()).toEqual(states[1]);
    expect(history.redo()).toEqual(states[2]);
    expect(history.redo()).toEqual(states[3]);
  });

  test("yeni işlem yineleme yığınını temizler", () => {
    const a = projectWithDuration(1);
    const b = projectWithDuration(2);
    const c = projectWithDuration(3);
    const history = new History<Project>(a);
    history.execute(snapshotCommand(a, b));
    history.undo();
    expect(history.canRedo).toBe(true);
    history.execute(snapshotCommand(a, c));
    expect(history.canRedo).toBe(false);
    expect(projectDuration(history.current)).toBe(3);
  });

  test("yığın en fazla 100 adım tutar", () => {
    const base = projectWithDuration(1);
    const history = new History<Project>(base, 100);
    for (let i = 0; i < 120; i += 1) {
      const next = projectWithDuration(1 + (i + 1) / 100);
      history.execute(snapshotCommand(history.current, next));
    }
    expect(history.depth).toBe(100);
    for (let i = 0; i < 100; i += 1) history.undo();
    expect(history.canUndo).toBe(false);
  });

  test("amend sonucu günceller ve geri alma hareketin başına döner", () => {
    const start = projectWithDuration(1);
    const first = projectWithDuration(2);
    const amended = projectWithDuration(2.5);
    const history = new History<Project>(start);
    history.execute(snapshotCommand(start, first));
    history.amend(amended);
    expect(projectDuration(history.current)).toBe(2.5);
    expect(projectDuration(history.undo())).toBe(1);
    expect(projectDuration(history.redo())).toBe(2.5);
  });
});
