import type { DeploymentState } from "@/app/mcp/registry/_parts/deployment-status";
import type { CatalogItem, Pod, Preset } from "../_seed/types";

export function presetsForCatalog(presets: Preset[], catalogId: string) {
  return presets.filter((p) => p.catalogId === catalogId);
}

export function podsForCatalog(pods: Pod[], catalogId: string) {
  return pods.filter((p) => p.catalogId === catalogId);
}

export function podsRunning(pods: Pod[]) {
  return pods.filter((p) => p.status === "up").length;
}

export function visiblePresetsForUser(
  presets: Preset[],
  userTeamIds: string[],
) {
  return presets.filter((p) => {
    if (p.visibility.kind === "org") return true;
    return userTeamIds.includes(p.visibility.teamId);
  });
}

export function tenancyLabel(c: CatalogItem) {
  return c.tenancy === "multi" ? "Multi-tenant" : "Single-tenant";
}

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function podStateMapping(status: Pod["status"]): {
  state: DeploymentState;
  label: string;
} {
  switch (status) {
    case "up":
      return { state: "running", label: "up" };
    case "down":
      return { state: "failed", label: "down" };
    case "restarting":
      return { state: "pending", label: "restarting" };
    case "degraded":
      return { state: "degraded", label: "degraded" };
  }
}

export function presetHealth(podStatuses: Pod["status"][]): DeploymentState {
  if (podStatuses.length === 0) return "pending";
  if (podStatuses.every((s) => s === "up")) return "running";
  if (podStatuses.some((s) => s === "down")) return "failed";
  if (podStatuses.some((s) => s === "degraded")) return "degraded";
  return "pending";
}

export function renderTemplate(
  template: string,
  envValues: Record<string, string | number | boolean>,
  userValues: Record<string, string>,
) {
  return template.replace(/\{(env|user)\.([a-zA-Z0-9_]+)\}/g, (_m, ns, key) => {
    if (ns === "env") return String(envValues[key] ?? `<${key}>`);
    return userValues[key] ?? `<${key}>`;
  });
}
