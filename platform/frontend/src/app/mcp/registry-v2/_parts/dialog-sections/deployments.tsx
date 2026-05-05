"use client";

import {
  ChevronRight,
  FileText,
  RefreshCw,
  ScrollText,
  Search,
  Terminal as TerminalIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DeploymentStatusDot } from "@/app/mcp/registry/_parts/deployment-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSpikeStore } from "../../_seed/store";
import type { Pod } from "../../_seed/types";
import { fmtDate, podStateMapping } from "../utils";

function PodActionDialog({
  pod,
  action,
  open,
  onOpenChange,
}: {
  pod: Pod | null;
  action: "logs" | "shell" | "inspector" | "yaml" | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!pod || !action) return null;
  const titleMap = {
    logs: `Logs · ${pod.name}`,
    shell: `Shell · ${pod.name}`,
    inspector: `Inspector · ${pod.name}`,
    yaml: `K8s YAML · ${pod.name}`,
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{titleMap[action]}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border bg-black p-4 font-mono text-[11px] text-green-400">
          {action === "logs" && (
            <pre className="whitespace-pre-wrap">{`[2026-05-03 22:35:00] starting mcp server
[2026-05-03 22:35:00] transport=streamable-http port=8080 path=/mcp
[2026-05-03 22:35:01] connected to upstream
[2026-05-03 22:35:01] ready
[2026-05-03 22:36:14] tools/list called by alice@example.com (preset=Studio 1)
[2026-05-03 22:36:14] returning 5 tools`}</pre>
          )}
          {action === "shell" && (
            <pre className="whitespace-pre-wrap">{`$ kubectl exec -it ${pod.name} -- sh
/ # echo "spike: shell stub"
spike: shell stub
/ # _`}</pre>
          )}
          {action === "inspector" && (
            <div className="text-muted-foreground">
              Inspector UI would mount here.
            </div>
          )}
          {action === "yaml" && (
            <pre className="whitespace-pre-wrap text-yellow-300">{`apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${pod.name}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${pod.name}
  template:
    spec:
      containers:
        - name: mcp
          image: ${pod.image}`}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PodRow({ pod }: { pod: Pod }) {
  const { presets, restartPod } = useSpikeStore();
  const preset = presets.find((p) => p.id === pod.presetId);
  const podState = podStateMapping(pod.status);
  const [expanded, setExpanded] = useState(false);
  const [dialogAction, setDialogAction] = useState<
    "logs" | "shell" | "inspector" | "yaml" | null
  >(null);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
        <span className="truncate font-mono text-xs">{pod.name}</span>
        {preset && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {preset.label}
          </span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {pod.tenancy === "multi" ? "multi-tenant" : "single-tenant"}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <DeploymentStatusDot state={podState.state} />
          {podState.label}
        </span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t bg-muted/20 px-3 py-3 pl-9">
          <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-xs">
            <span className="text-muted-foreground">started</span>
            <span>{fmtDate(pod.startedAt)}</span>
            <span className="text-muted-foreground">restarts</span>
            <span>{pod.restarts}</span>
            <span className="text-muted-foreground">callers</span>
            <span>{pod.callerCount}</span>
            <span className="text-muted-foreground">owner</span>
            <span>{pod.ownerLabel}</span>
            <span className="text-muted-foreground">image</span>
            <span className="font-mono">{pod.image}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDialogAction("logs")}
            >
              <ScrollText className="h-3.5 w-3.5" />
              Logs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDialogAction("shell")}
            >
              <TerminalIcon className="h-3.5 w-3.5" />
              Shell
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDialogAction("inspector")}
            >
              <Search className="h-3.5 w-3.5" />
              Inspector
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => restartPod(pod.id)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restart
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDialogAction("yaml")}
            >
              <FileText className="h-3.5 w-3.5" />
              K8s YAML
            </Button>
          </div>
        </div>
      )}
      <PodActionDialog
        pod={pod}
        action={dialogAction}
        open={dialogAction !== null}
        onOpenChange={(v) => !v && setDialogAction(null)}
      />
    </div>
  );
}

export function DeploymentsSection({ catalogId }: { catalogId: string }) {
  const { presets, pods, term } = useSpikeStore();
  const cpods = pods.filter((p) => p.catalogId === catalogId);
  const items = presets.filter((p) => p.catalogId === catalogId);
  const [presetFilter, setPresetFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(
    () =>
      cpods.filter(
        (p) =>
          (presetFilter === "all" || p.presetId === presetFilter) &&
          (statusFilter === "all" || p.status === statusFilter),
      ),
    [cpods, presetFilter, statusFilter],
  );

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Per-pod runtime view.</p>
        <div className="flex items-center gap-2">
          <Select value={presetFilter} onValueChange={setPresetFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder={term.Singular} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {term.plural}</SelectItem>
              {items.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="up">up</SelectItem>
              <SelectItem value="down">down</SelectItem>
              <SelectItem value="restarting">restarting</SelectItem>
              <SelectItem value="degraded">degraded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border px-4 py-6 text-center text-xs text-muted-foreground">
          No pods match the current filters.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border">
          {filtered.map((p) => (
            <PodRow key={p.id} pod={p} />
          ))}
        </div>
      )}
    </div>
  );
}
