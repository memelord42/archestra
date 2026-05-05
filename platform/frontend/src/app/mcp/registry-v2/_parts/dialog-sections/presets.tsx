"use client";

import {
  ArrowUpCircle,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { DeploymentStatusDot } from "@/app/mcp/registry/_parts/deployment-status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpikeStore } from "../../_seed/store";
import type { CatalogItem, Preset } from "../../_seed/types";
import { PresetEditorDialog } from "../preset-editor-dialog";
import { fmtDate, presetHealth } from "../utils";

export function PresetsSection({ catalogId }: { catalogId: string }) {
  const {
    catalogItems,
    presets,
    presetNames,
    credentials,
    pods,
    deletePreset,
    upgradePreset,
    term,
  } = useSpikeStore();
  const cat = catalogItems.find((c) => c.id === catalogId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [prefilledLabel, setPrefilledLabel] = useState<string | undefined>(
    undefined,
  );

  if (!cat) return null;

  function openNew(label?: string) {
    setEditing(null);
    setPrefilledLabel(label);
    setEditorOpen(true);
  }

  function openEdit(preset: Preset) {
    setEditing(preset);
    setPrefilledLabel(undefined);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Named parameter sets shared across catalog items.
        </p>
        <Button size="sm" onClick={() => openNew()}>
          <Plus className="h-4 w-4" />
          New {term.singular}
        </Button>
      </div>

      <div className="divide-y divide-border rounded-md border">
        {presetNames.map((name) => {
          const p = presets.find(
            (pr) => pr.catalogId === catalogId && pr.label === name,
          );
          if (!p) {
            return (
              <EmptyPresetRow
                key={name}
                name={name}
                onConfigure={() => openNew(name)}
              />
            );
          }
          return (
            <ConfiguredPresetRow
              key={p.id}
              cat={cat}
              preset={p}
              callers={credentials.filter((c) => c.presetId === p.id).length}
              ppods={pods.filter((pod) => pod.presetId === p.id)}
              onEdit={() => openEdit(p)}
              onDelete={() => deletePreset(p.id)}
              onUpgrade={() => upgradePreset(p.id)}
            />
          );
        })}
      </div>

      <PresetEditorDialog
        cat={cat as CatalogItem}
        preset={editing}
        prefilledLabel={prefilledLabel}
        open={editorOpen}
        onOpenChange={(v) => {
          setEditorOpen(v);
          if (!v) {
            setEditing(null);
            setPrefilledLabel(undefined);
          }
        }}
      />
    </div>
  );
}

function EmptyPresetRow({
  name,
  onConfigure,
}: {
  name: string;
  onConfigure: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onConfigure}
      className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/40"
    >
      <Plus className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
      <span>{name}</span>
    </button>
  );
}

function ConfiguredPresetRow({
  cat,
  preset,
  callers,
  ppods,
  onEdit,
  onDelete,
  onUpgrade,
}: {
  cat: CatalogItem;
  preset: Preset;
  callers: number;
  ppods: { status: "up" | "down" | "restarting" | "degraded" }[];
  onEdit: () => void;
  onDelete: () => void;
  onUpgrade: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const health = presetHealth(ppods.map((pod) => pod.status));
  const isPinned = preset.pinnedVersion !== null;
  const upgradeAvailable =
    isPinned && preset.pinnedVersion !== cat.latestVersion;

  const visibilityLabel =
    preset.visibility.kind === "org"
      ? "org-wide"
      : `team: ${preset.visibility.teamName}`;
  const versionLabel = isPinned
    ? `pinned ${preset.pinnedVersion}`
    : `${cat.latestVersion} (latest)`;

  const fieldEntries = Object.entries(preset.fieldValues);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
          <span className="text-sm font-medium">{preset.label}</span>
          <span className="truncate text-xs text-muted-foreground">
            {preset.isDefault && (
              <>
                default <span className="opacity-50">·</span>{" "}
              </>
            )}
            {visibilityLabel} <span className="opacity-50">·</span>{" "}
            <span
              className={
                isPinned ? "" : "text-emerald-600 dark:text-emerald-400"
              }
            >
              {versionLabel}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {upgradeAvailable && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onUpgrade}
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Upgrade to {cat.latestVersion}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 border-t bg-muted/20 px-3 py-3 pl-9">
          {fieldEntries.length > 0 ? (
            <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-xs font-mono">
              {fieldEntries.map(([k, v]) => (
                <div key={k} className="contents">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              No field values.
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {ppods.length > 0 ? (
                <DeploymentStatusDot state={health} />
              ) : (
                <span className="inline-block h-2 w-2 rounded-full bg-muted" />
              )}
              {ppods.length === 0
                ? "no pods"
                : health === "running"
                  ? "up"
                  : health}
            </span>
            <span className="opacity-50">·</span>
            <span>
              {callers} {callers === 1 ? "caller" : "callers"}
            </span>
            <span className="opacity-50">·</span>
            <span>
              {ppods.length} {ppods.length === 1 ? "pod" : "pods"}
            </span>
            <span className="opacity-50">·</span>
            <span>created {fmtDate(preset.createdAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
