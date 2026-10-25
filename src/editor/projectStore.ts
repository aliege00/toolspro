import {
  PROJECT_DIR,
  deleteStored,
  listStored,
  readJson,
  writeJson,
} from "@/lib/storage";
import type { Project } from "./types";

function projectPath(id: string): string {
  return `${PROJECT_DIR}/${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

/** Özel depodaki tüm projeleri okur; bozuk dosyalar atlanır. */
export async function listProjects(): Promise<Project[]> {
  const files = await listStored(PROJECT_DIR);
  const projects: Project[] = [];
  for (const file of files) {
    if (!file.name.endsWith(".json")) continue;
    const project = await readJson<Project>(`${PROJECT_DIR}/${file.name}`);
    if (
      project &&
      project.schema === 1 &&
      typeof project.id === "string" &&
      Array.isArray(project.tracks)
    ) {
      projects.push(project);
    }
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<Project | null> {
  return readJson<Project>(projectPath(id));
}

export async function saveProject(project: Project): Promise<void> {
  await writeJson(projectPath(project.id), project);
}

export async function deleteProject(id: string): Promise<void> {
  await deleteStored(projectPath(id));
}

export function duplicateProject(project: Project, name: string): Project {
  const now = Date.now();
  return {
    ...project,
    id: `${project.id}-${now.toString(36)}`,
    name,
    createdAt: now,
    updatedAt: now,
    tracks: project.tracks.map((track) => ({
      ...track,
      id: `${track.id}-${now.toString(36)}`,
      clips: track.clips.map((clip) => ({
        ...clip,
        id: `${clip.id}-${now.toString(36)}`,
      })),
    })),
  };
}
