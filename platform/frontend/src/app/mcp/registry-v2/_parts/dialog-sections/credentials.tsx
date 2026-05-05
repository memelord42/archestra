"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSpikeStore } from "../../_seed/store";
import type { CatalogItem } from "../../_seed/types";
import { InstallDialog } from "../install-dialog";
import { fmtDate } from "../utils";

export function CredentialsSection({ cat }: { cat: CatalogItem }) {
  const { presets, credentials, revokeCredential, currentUser, term } =
    useSpikeStore();
  const items = presets.filter((p) => p.catalogId === cat.id);
  const [filter, setFilter] = useState<string>("all");

  const rows = useMemo(() => {
    return credentials
      .map((c) => {
        const preset = items.find((p) => p.id === c.presetId);
        if (!preset) return null;
        return { c, preset };
      })
      .filter(
        (row): row is NonNullable<typeof row> =>
          row !== null && (filter === "all" || row.preset.id === filter),
      );
  }, [items, credentials, filter]);

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Per-({term.singular}, caller) credential rows.
        </p>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
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
          <InstallDialog cat={cat} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border px-4 py-6 text-center text-xs text-muted-foreground">
          No credentials yet.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">{term.Singular}</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="w-[80px]">Scope</TableHead>
                <TableHead className="w-[100px]">Storage</TableHead>
                <TableHead>Pod</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ c, preset }) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm">{preset.label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="truncate">{c.ownerEmail}</span>
                      {c.ownerId === currentUser.id && (
                        <Badge variant="outline" className="text-[9px]">
                          You
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.scope}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.secretStorage}
                  </TableCell>
                  <TableCell>
                    <span className="truncate font-mono text-xs">
                      {c.podId}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(c.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => revokeCredential(c.id)}
                      aria-label="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
