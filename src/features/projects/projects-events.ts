export const LOTEA_PROJECTS_UPDATED_EVENT = "lotea:projects-updated";

export function notifyProjectsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOTEA_PROJECTS_UPDATED_EVENT));
}
