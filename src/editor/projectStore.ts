import {
  PROJECT_DIR,
  deleteStored,
  listStored,
  readJson,
  writeJson,
} from "@/lib/storage";
import { logError } from "@/lib/errorLog";
import { migrateProject, newId } from "./core/model";
import type { Project } from "./core/model";

function projectPath(id: string): string {
  return `${PROJECT_DIR}/${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

/** Diskteki JSON'u güncel şemaya taşır; bozuk dosyayı atlar ve günlüğe yazar. */
async function readProject(path: string): Promise<Project | null> {
  const raw = await readJson<unknown>(path);
  if (!raw) return null;
  try {
    const migrated = migrateProject(raw);
    if (migrated.from < 2) await writeJson(path, migrated.project);
    return migrated.project;
  } catch (error) {
    logError("Editör projesi", error);
    return null;
  }
}

/** Özel depodaki tüm projeleri okur; bozuk dosyalar atlanır. */
export async function listProjects(): Promise<Project[]> {
  const files = await listStored(PROJECT_DIR);
  const projects: Project[] = [];
  for (const file of files) {
    if (!file.name.endsWith(".json")) continue;
    const project = await readProject(`${PROJECT_DIR}/${file.name}`);
    if (project) projects.push(project);
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<Project | null> {
  return readProject(projectPath(id));
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
    id: newId("project"),
    name,
    createdAt: now,
    updatedAt: now,
    tracks: project.tracks.map((track) => ({
      ...track,
      id: newId("track"),
      clips: track.clips.map((clip) => ({
        ...clip,
        id: newId("clip"),
        filter: { ...clip.filter },
        text: clip.text ? { ...clip.text } : undefined,
        pip: clip.pip ? { ...clip.pip } : undefined,
      })),
    })),
  };
}

export function renamedProject(project: Project, name: string): Project {
  return { ...project, name: name.trim() || project.name, updatedAt: Date.now() };
}
