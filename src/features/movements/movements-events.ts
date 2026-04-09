export const LOTEA_MOVEMENTS_UPDATED_EVENT = "lotea:movements-updated";

export function notifyMovementsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOTEA_MOVEMENTS_UPDATED_EVENT));
}
